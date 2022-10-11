import { createChart, ChartOptions, DeepPartial, IChartApi, ISeriesApi, MouseEventParams, UTCTimestamp, CandlestickData, HistogramData, SeriesMarker, Time } from 'lightweight-charts';
import { restClient, websocketClient } from '@polygon.io/client-js';
import { useRef, useEffect, useState, useMemo } from 'preact/hooks';
import { Toolbar, Timespan } from './toolbar';
import { Split, SplitItem } from './split';
import { TickerDetails } from './tickerdetails';
import { toymd, fetchAggs, getTimespanMS, getWSTicker, getOverlay, Aggregate, aggBar, getTickerMarket, convertTZ } from './helpers';
import './chart.css';

function toCandlestickData(a: Aggregate): CandlestickData {
	const res = a as unknown /* for time: UTCTimestamp */ as CandlestickData;
	if (res.open) {
		res.color = a.open < a.close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
	}
	return res;
}

function toHistogram(a: Aggregate): HistogramData {
	const res = { time: a.time } as HistogramData;
	if (a.volume) {
		res.value = a.volume;
		res.color = a.open < a.close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
	}
	return res;
}

function toHistogramVWAP(a: Aggregate): HistogramData {
	const res = { time: a.time } as HistogramData;
	if (a.vwap) {
		res.value = a.vwap;
		res.color = 'purple';
	}
	return res;
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
	const [aggs, setAggs] = useState([] as Aggregate[]);
	const [fitContent, setFitContent] = useState(false);
	// data picker
	const [ticker, setTicker] = useState('AAPL');
	const [multiplier, setMultiplier] = useState(1);
	const [timespan, setTimespan] = useState<Timespan>('minute');
	const [date, setDate] = useState(toymd(new Date()));
	const [timezone, setTimezone] = useState('America/New_York');
	const [showDetails, setShowDetails] = useState(window.innerWidth > 1400);
	useEffect(onResize, [showDetails]); // Resize on show/hide side pane
	const [showMarkers, setShowMarkers] = useState(false);

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
		let isLoading = true;
		if (!ticker) {
			setStatus('No ticker');
		}

		setAggs([]);
		setStatus(`Loading ${ticker}...`);
		fetchAggs(rest, ticker, multiplier, timespan, date)
			.then(candles => {
				if (!isLoading) {
					return;
				}
				if (candles.length > 0) {
					setStatus('');
					setAggs(candles);
					setFitContent(true);
				} else {
					setStatus(`No data for ${ticker}`);
				}
			});

		return () => isLoading = false;
	}, [ticker, multiplier, timespan, date]);

	async function refresh() {
		let isLoading = true;

		setStatus(`Refreshing ${ticker}...`);
		return fetchAggs(rest, ticker, multiplier, timespan, date)
			.then(candles => {
				if (!isLoading) {
					return;
				}
				candles = candles.filter(c => c.time > aggs[aggs.length - 1].time);
				if (candles.length > 0) {
					updateSeriesData(series, candles, true);
				}
				setStatus('');
			});
	}

	// Update markers
	useEffect(() => {
		if (!showMarkers && series.length > 0) {
			series[0].setMarkers([]);
			return;
		}
		if (aggs.length === 0 || series.length === 0 || !showMarkers || getTickerMarket(ticker) !== 'stocks') {
			return;
		}
		Promise.all([
			rest.reference.stockSplits({ ticker, limit: 1000 }),
			rest.reference.dividends({ ticker, limit: 1000 }),
		]).then(([splits, dividends]) => {
			let markers = [] as SeriesMarker<Time>[];
			if (splits.results) {
				splits.results
					.forEach(s => markers.push({
						time: convertTZ(new Date(s.execution_date), timezone).getTime() / 1000 as UTCTimestamp,
						position: 'aboveBar',
						shape: 'arrowDown',
						text: `${s.split_from} for ${s.split_to} split ${s.execution_date}`
					} as SeriesMarker<Time>));
			}
			if (dividends.results) {
				dividends.results
					.forEach(d => markers.push({
						time: convertTZ(new Date(d.ex_dividend_date), timezone).getTime() / 1000 as UTCTimestamp,
						position: 'aboveBar',
						shape: 'arrowDown',
						text: `${d.dividend_type} ${d.cash_amount} ${d.ex_dividend_date}`
					} as SeriesMarker<Time>));
			}

			markers = markers
				.filter(m => {
					const epochMS = m.time as number * 1000;
					return epochMS > aggs[0].time && epochMS < aggs[aggs.length - 1].time;
				})
				.sort((a, b) => a.time > b.time ? 1 : -1);
			series[0].setMarkers(markers);
		});
	}, [ticker, series, aggs, showMarkers]);

	// Update series + view + crosshair
	function updateSeriesData(series: ISeriesApi<any>[], newAggs: Aggregate[], update: Boolean) {
		// convert ts
		const timezoneAggs = newAggs.map(agg => ({
			...agg,
			time: convertTZ(new Date(agg.time), timezone).getTime() / 1000 as UTCTimestamp,
		}));
		// candle
		if (update) {
			timezoneAggs.forEach(a => series[0].update(toCandlestickData(a)));
		} else {
			series[0].setData(timezoneAggs.map(toCandlestickData));
		}
		// volume
		if (update) {
			timezoneAggs.forEach(a => series[1].update(toHistogram(a)));
		} else {
			series[1].setData(timezoneAggs.map(toHistogram));
		}
		// vwap 
		if (update) {
			timezoneAggs.forEach(a => series[2].update(toHistogramVWAP(a)));
		} else {
			series[2].setData(timezoneAggs.map(toHistogramVWAP));
		}
	}
	useEffect(() => {
		if (!chart) {
			return;
		}
		if (aggs.length === 0) {
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
		updateSeriesData(series,aggs, false);
		if (fitContent) {
			chart.timeScale().fitContent();
			setFitContent(false);
			setReachedEnd(false);
		}
	}, [aggs, timezone]);

	// infinite scrolling back
	const [reachedEnd, setReachedEnd] = useState(false);

	useEffect(() => {
		if (!chart) {
			return;
		}
		let isLoading = false;
		function onRangeChange() {
			if (isLoading || aggs.length === 0 || series.length === 0 || reachedEnd) {
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
				epochMS = aggs[0].time - timespanMS;
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

			fetchAggs(rest, ticker, multiplier, timespan, epochMS)
				.then(newData => {
					isLoading = false;
					if (newData.length === 0) {
						setReachedEnd(true);
					} else {
						setAggs([...newData, ...aggs]);
					}
					setStatus('');
					chart.applyOptions({ handleScroll: true });
				});
		}
		chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

		return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
	}, [ticker, multiplier, timespan, aggs, reachedEnd]);

	// live
	const [live, setLive] = useState(false);
	useEffect(() => {
		if (!live || multiplier !== 1 || timespan !== 'minute') {
			return;
		}
		refresh();
		console.log('live', ticker);
		const ws = websocketClient(apiKey);
		let client: WebSocket;
		let topic: string;
		// let lastAgg: Promise<Aggregate>;

		switch (getTickerMarket(ticker)) {
			case 'crypto':
			client = ws.crypto();
			topic = 'XT';
			// todo: get all trades in period + agg them
			//lastAgg = rest.crypto.trades(ticker)
			//	.then(res => res.results.map(t => ({
			//		ts: t.participant_timestamp,
			//		price: t.price,
			//		size: t.size,
			//	)}))
			//	.then(aggTrades);
			break;
			case 'options':
			client = ws.options();
			topic = 'T';
			break;
			case 'forex':
			client = ws.forex();
			topic = 'CA';
			break;
			case 'stocks':
			client = ws.stocks();
			topic = 'T';
			break;
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
					const oldBar = aggs.length === 0 ? { time: 0 } as Aggregate : aggs[aggs.length - 1];
					const newBar = aggBar(oldBar, message.t, message.p, message.s, timespan, multiplier);
					if (oldBar.time !== newBar.time) {
						aggs.push(newBar);
					} else {
						aggs[aggs.length - 1] = newBar;
					}
					updateSeriesData(series, [newBar], true);
					// newBar.color = newBar.open < newBar.close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
					// newBar.value = newBar.volume;
					break;
				default:
					break;
			}
		};

		return () => {
			console.log('not live', ticker);
			client.close();
		};
	}, [series, live]);

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
					timezone={timezone}
					setTimezone={setTimezone}
					showMarkers={showMarkers}
					setShowMarkers={setShowMarkers}
					onRefresh={refresh}
				/>
				<div id="chart" ref={div}>
					{showOverlay && (
						<>
							<div class="chart-overlay chart-overlay-ohlcv">
								{getOverlay(hover)}
							</div>
							{div.current && chart && chart.timeScale().scrollPosition() < 0 && (
								<div class="chart-overlay chart-overlay-goto-recent">
									<button title="Goto recent" onClick={() => chart.timeScale().scrollToRealTime()}>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="14" height="14">
											<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6.5 1.5l5 5.5-5 5.5M3 4l2.5 3L3 10" />
										</svg>
									</button>
								</div>
							)}
						</>
					)}
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

