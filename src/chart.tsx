import { createChart, ChartOptions, DeepPartial, IChartApi, ISeriesApi, MouseEventParams, UTCTimestamp } from 'lightweight-charts';
import { restClient, websocketClient } from '@polygon.io/client-js';
import { useRef, useEffect, useState, useMemo } from 'preact/hooks';
import { Toolbar, Timespan } from './toolbar';
import { Split, SplitItem } from './split';
import { TickerDetails } from './tickerdetails';
import { toymd, loadData, getTimespanMS, getWSTicker, getOverlay, Aggregate, aggBar } from './helpers';
import './chart.css';

interface SeriesAggregate extends Aggregate {
	value?: number; // Optimization for volume so we can reuse same object
	color?: string;
}

interface Trade {
	ts: number;
	price: number;
	size: number;
	conditions: number[];
}

function isEligible(t: Trade): bool {
	return true;
}

// Assumes all trades are in window.
function aggTrades(trades: Trade[], time: UTCTimestamp): Aggregate | undefined {
	let res = {} as Aggregate;

	trades.filter(isEligible).forEach(t => {
		if (res.open === 0) {
			res = {
				time: time,
				open: t.price,
				high: t.price,
				low: t.price,
				close: t.price,
				volume: t.size,
				liquidity: t.size * t.price,
				vwap: t.price,
			};
		} else {
			res.liquidity += t.size * t.price;
			res.volume += t.size;
			res.vwap = res.liquidity / res.volume;
			res.close = t.price;
			if (t.price > res.high) {
				res.high = t.price;
			} else if (t.price < res.low) {
				res.low = t.price;
			}
		}
	});

	return res.open ? res : undefined;
}

export function Chart({ apiKey }) {
	// lightweight-charts
	const div = useRef();
	const [chart, setChart] = useState(null as IChartApi);
	const [options, setOptions] = useState({} as DeepPartial<ChartOptions>);
	let [series, setSeries] = useState([] as ISeriesApi<any>[]);

	// hover
	const [showOverlay, setShowOverlay] = useState(true);
	const [hover, setHover] = useState({} as MouseEventParams);
	function onCrosshairMove(p: MouseEventParams) {
		setHover(p);
	}

	useEffect(() => {
		const newChart = createChart(div.current, {
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
			},
			localization: {
				locale: 'en',
				dateFormat: 'yyyy-MM-dd',
			},
		});
		setChart(newChart);
		newChart.subscribeCrosshairMove(onCrosshairMove);

		return () => newChart.unsubscribeCrosshairMove(onCrosshairMove);
	}, []);

	const onResize = useMemo(() => () => {
		if (!chart || !div.current)
			return;
		const ele = div.current as HTMLDivElement;
		chart.resize(ele.offsetWidth, ele.offsetHeight, true);
	}, [chart, div]);

	useEffect(() => {
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [onResize]);

	useEffect(() => {
		if (!options || Object.keys(options).length === 0 || !chart) {
			return;
		}
		chart.applyOptions(options);
	}, [options, chart]);

	// data
	const rest = useMemo(() => restClient(apiKey), [apiKey]);
	const [data, setData] = useState([] as Aggregate[]);
	const [fitContent, setFitContent] = useState(false);
	// data picker
	const [ticker, setTicker] = useState('X:BTCUSD');
	const [multiplier, setMultiplier] = useState(1);
	const [timespan, setTimespan] = useState('day' as Timespan);
	const [date, setDate] = useState(toymd(new Date()));
	const [showDetails, setShowDetails] = useState(true);
	useEffect(onResize, [showDetails]); // Resize on show/hide side pane

	function setStatus(text: string, color: string = 'white') {
		if (chart) {
			chart.applyOptions({
				watermark: {
					visible: true,
					text: text,
					color: color,
				}
			});
		}
	}

	// Update data
	useEffect(() => {
		let isSubbed = true;
		if (!ticker) {
			setStatus('No ticker');
		}

		setData([]);
		setStatus(`Loading ${ticker}...`);
		loadData(rest, ticker, multiplier, timespan, date)
			.then(candles => {
				if (!isSubbed) {
					return;
				}
				if (candles.length > 0) {
					setStatus('');
					setData(candles);
					setFitContent(true);
				} else {
					setStatus(`No data for ${ticker}`);
				}
			});

		return () => isSubbed = false;
	}, [ticker, multiplier, timespan, date]);

	// Update series + view + crosshair
	useEffect(() => {
		if (!chart) {
			return;
		}
		if (data.length === 0) {
			series.forEach(s => chart.removeSeries(s));
			series = [];
			setSeries([]);
		}
		if (series.length === 0) {
			series.push(chart.addCandlestickSeries());
			series.push(chart.addHistogramSeries({
				lastValueVisible: false,
				priceLineVisible: false,
				priceFormat: {
					type: 'volume',
				},
				priceScaleId: 'left',
			}));
			series.push(chart.addLineSeries());
			setSeries(series);
		}
		// candle
		series[0].setData(data);
		// volume
		series[1].setData(data);
		// vwap 
		series[2].setData(data.map(bar => ({
			time: bar.time,
			value: bar.vwap,
			color: 'purple',
		})));
		if (fitContent) {
			chart.timeScale().fitContent();
			setFitContent(false);
			setReachedEnd(false);
		}
	}, [data]);

	// infinite scrolling back
	const [reachedEnd, setReachedEnd] = useState(false);

	useEffect(() => {
		if (!chart) {
			return;
		}
		let isLoading = false;
		function onRangeChange() {
			if (isLoading || data.length === 0 || series.length === 0 || reachedEnd) {
				return;
			}
			const logicalRange = chart.timeScale().getVisibleLogicalRange();
			const barsInfo = series[0].barsInLogicalRange(logicalRange);
			const loadBackwards = barsInfo && barsInfo.barsBefore < -10;
			if (!barsInfo || !loadBackwards) {
				return;
			}
			isLoading = true;
			chart.applyOptions({ handleScroll: false });

			const timespanMS = getTimespanMS(timespan);
			let epochMS: number;
			if (loadBackwards) {
				epochMS = data[0].time as number * 1000 - timespanMS;
				// console.log('loading more bars before', epochMS, data[0].time);
				setStatus(`Loading before ${new Date(epochMS).toISOString().substring(0, 10)}...`);
			} else {
				// TODO: get axis to not snap to newest date on load (which forces more data
				// to have to be loaded)
				isLoading = false;
				chart.applyOptions({ handleScroll: true });
				return;
				//epochMS = data[data.length - 1].time as number * 1000 + getLocalOffsetMS() + timespanMS;
				//console.log('need more bars after', new Date(epochMS).toISOString());
				// setStatus(`Loading after ${new Date(epochMS).toISOString().substring(0, 10)}`, 'rgba(100, 100, 100, 0.3)');
			}

			loadData(rest, ticker, multiplier, timespan, epochMS)
				.then(newData => {
					// console.log('loaded', newData.length, 'more bars', newData);
					isLoading = false;
					if (newData.length === 0) {
						setReachedEnd(true);
					}
					// console.log('newData', newData, 'oldData', data);
					setData([...newData, ...data]);
					setStatus('');
					chart.applyOptions({ handleScroll: true });
				});
		}
		chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

		return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
	}, [ticker, multiplier, timespan, data, reachedEnd]);

	// live
	const [live, setLive] = useState(false);
	useEffect(() => {
		if (!live || multiplier !== 1 || timespan !== 'minute') {
			return;
		}
		console.log('live');
		const ws = websocketClient(apiKey);
		let client: WebSocket;
		let topic: string;
		// let lastAgg: Promise<Aggregate>;

		if (ticker.startsWith('X:')) {
			client = ws.crypto();
			topic = 'XA'; // 'XT';
			// todo: get all trades in period + agg them
			//lastAgg = rest.crypto.trades(ticker)
			//	.then(res => res.results.map(t => ({
			//		ts: t.participant_timestamp,
			//		price: t.price,
			//		size: t.size,
			//	)}))
			//	.then(aggTrades);
		} else if (ticker.startsWith('O:')) {
			client = ws.options();
			topic = 'AM'; //'T';
		} else if (ticker.startsWith('C:')) {
			client = ws.forex();
			topic = 'CA';
		} else {
			client = ws.stocks();
			topic = 'AM'; //'T';
		}

		client.onmessage = ({ data: msg }) => {
			const [message] = JSON.parse(msg);
			// console.log('message', message);

			switch (message.ev) {
				case 'status':
					if (message.status === 'auth_success') {
						getWSTicker(rest, ticker).then(ticker => {
							console.log('subbing to', ticker);
							client.send(JSON.stringify({
								action: 'subscribe',
								params: `${topic}.${ticker}`
							}))
						});
					}
					break;
				case 'AM':
				case 'CA':
				case 'XA':
					const time = message.s;
					const	color = message.o < message.c ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
					series[0].update({
						time: time,
						open: message.o,
						high: message.h,
						low: message.l,
						close: message.c,
						color: color,
					});
					series[1].update({
						time: time,
						value: message.v,
						color: color,
					});
					series[2].update({
						time: time,
						value: message.vw,
						color: 'purple',
					});
					break;
				case 'T':
				case 'XT':
					const isStock = message.sym && message.sym[1] !== ':';
					const oldBar = data[data.length - 1];
					const newBar = aggBar(oldBar, message.t, message.p, message.s, timespan, multiplier, isStock) as SeriesAggregate;
					newBar.color = newBar.open < newBar.close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
					newBar.value = newBar.volume;
					console.log('update', oldBar, newBar);
					// candlestick
					series[0].update(newBar);
					// volume
					series[1].update(newBar);
					// vwap
					series[2].update({
						time: newBar.time,
						value: newBar.vwap
					});
					break;
				default:
					break;
			}
		};

		return () => {
			console.log('not live');
			client.close();
		};
	}, [ticker, live]);

	return (
		<Split>
			<SplitItem>
				<Toolbar
					setOptions={setOptions}
					live={live}
					setLive={setLive}
					ticker={ticker}
					setTicker={setTicker}
					multiplier={multiplier}
					setMultiplier={setMultiplier}
					timespan={timespan}
					setTimespan={setTimespan}
					date={date}
					setDate={setDate}
					rest={rest}
					showDetails={showDetails}
					setShowDetails={setShowDetails}
					showOverlay={showOverlay}
					setShowOverlay={setShowOverlay}
				/>
				<div id="chart" ref={div}>
					<div id="chart-overlay">
						{showOverlay && getOverlay(hover)}
					</div>
				</div>
			</SplitItem>
			{showDetails && 
				<SplitItem>
					<TickerDetails rest={rest} ticker={ticker} />
				</SplitItem>
			}
		</Split>
	);
}

