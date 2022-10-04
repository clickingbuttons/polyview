import { CandlestickData, createChart, UTCTimestamp, ChartOptions, DeepPartial, IChartApi, ISeriesApi } from 'lightweight-charts';
import { restClient, websocketClient, IRestClient } from '@polygon.io/client-js';
import { useRef, useEffect, useState, useMemo } from 'preact/hooks';
import { Toolbar, Timespan } from './toolbar';
import { Split, SplitItem } from './split';
import { TickerDetails } from './tickerdetails';
import './chart.css';

function getLocalOffsetMS(): number {
	return new Date().getTimezoneOffset() * 60 * 1000;
}

function getLocalTime(epochMS: number): UTCTimestamp {
	return (new Date(epochMS).getTime() - getLocalOffsetMS()) / 1000 as UTCTimestamp;
}

function toymd(date: Date) {
	return date.toISOString().substring(0, 10);
}

function getTimespanMS(timespan: Timespan): number {
	switch (timespan) {
		case 'minute':
			return 1000 * 60;
    case 'hour':
			return 1000 * 60 * 60;
    case 'day':
			return 1000 * 60 * 60 * 24;
    case 'week':
			return 1000 * 60 * 60 * 24 * 7;
    case 'month':
			return 1000 * 60 * 60 * 24 * 30;
    case 'quarter':
			return 1000 * 60 * 60 * 24 * 365/4;
    case 'year':
			return 1000 * 60 * 60 * 24 * 365;
	}
}

const barsPageSize = 10000;
async function loadData(rest: IRestClient, ticker: string, multiplier: number, timespan: string, date: string | number, loadForwards: boolean): Promise<CandlestickData[]> {
	// Cleverness: desc + reverse
	const from = loadForwards ? String(date) : '1970-01-01';
	const to = loadForwards ? '2100-01-01' : String(date);
	return rest.stocks.aggregates(ticker, multiplier, timespan, from, to, { limit: barsPageSize, sort: loadForwards ? 'asc' : 'desc' })
		.then(res => {
			if (!res.results)
				return [];

			return res.results.map(bar => ({
				// for candlestick series
				time: getLocalTime(bar.t),
				open: bar.o,
				high: bar.h,
				low: bar.l,
				close: bar.c,

				// for histogram series (also uses time)
				value: bar.v,
				color: bar.o < bar.c ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)',
			} as CandlestickData))
		})
		.then(candles => loadForwards ? candles : candles.reverse());
}

async function getWSTicker(rest: IRestClient, ticker: string): Promise<string> {
	if (ticker.startsWith('X')) {
		// ...polygon only allows XT:X:BTC-USD and not XT:X:BTCUSD :(
		return rest.reference.tickerDetails(ticker)
			.then(ticker => {
				const { base_currency_symbol, currency_symbol } = ticker.results as any;
				return `X:${base_currency_symbol}-${currency_symbol}`
			})
	} else {
		return `${ticker}`
	}
}

export function Chart({ apiKey }) {
	// lightweight-charts
	const div = useRef();
	const [chart, setChart] = useState(null as IChartApi);
	const [options, setOptions] = useState({} as DeepPartial<ChartOptions>);
	let [series, setSeries] = useState([] as ISeriesApi<any>[]);

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
	}, []);

	const onResize = useMemo(() => () => {
		if (!chart || !div.current)
			return;
		const ele = div.current as HTMLDivElement;
		chart.resize(ele.offsetWidth, ele.offsetHeight, true);
		console.log('Size changed');
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
	const [data, setData] = useState([] as CandlestickData[]);
	const [fitContent, setFitContent] = useState(false);
	// data picker
	const [ticker, setTicker] = useState('AAPL');
	const [multiplier, setMultiplier] = useState(1);
	const [timespan, setTimespan] = useState('day' as Timespan);
	const [date, setDate] = useState(toymd(new Date()));
	const [showDetails, setShowDetails] = useState(true);
	useEffect(onResize, [showDetails]);

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

	useEffect(() => {
		let isSubbed = true;
		if (!ticker) {
			setStatus('No ticker');
		}

		setData([]);
		setStatus(`Loading ${ticker}...`);
		loadData(rest, ticker, multiplier, timespan, date, false)
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
			setSeries(series);
		}
		series[0].setData(data);
		series[1].setData(data);
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
			const loadForwards = barsInfo && barsInfo.barsAfter < -10;
			if (!barsInfo || (!loadBackwards && !loadForwards)) {
				return;
			}
			isLoading = true;
			chart.applyOptions({ handleScroll: false });

			const timespanMS = getTimespanMS(timespan);
			let epochMS: number;
			if (loadBackwards) {
				epochMS = data[0].time as number * 1000 + getLocalOffsetMS() - timespanMS;
				// console.log('loading more bars before', new Date(epochMS).toISOString());
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

			loadData(rest, ticker, multiplier, timespan, epochMS, loadForwards)
				.then(newData => {
					// console.log('loaded', newData.length, 'more bars', newData);
					isLoading = false;
					if (newData.length === 0) {
						setReachedEnd(true);
					}
					if (loadBackwards) {
						setData([...newData, ...data]);
					} else {
						setData([...data, ...newData]);
					}
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
		if (!live) {
			return;
		}
		console.log('live');
		const ws = websocketClient(apiKey);
		let client: WebSocket;
		let topic: string;

		if (ticker.startsWith('X:')) {
			client = ws.crypto();
			topic = 'XA';
		} else if (ticker.startsWith('O:')) {
			client = ws.options();
			topic = 'AM';
		} else if (ticker.startsWith('C:')) {
			client = ws.forex();
			topic = 'CA';
		} else {
			client = ws.stocks();
			topic = 'AM';
		}

		client.onmessage = ({ data }) => {
			const [message] = JSON.parse(data);
			// console.log('message', message);

			switch (message.ev) {
				case 'status':
					if (message.status == 'auth_success') {
						getWSTicker(rest, ticker).then(ticker => {
							console.log('subbing to', ticker);
							client.send(JSON.stringify({
								action: 'subscribe',
								params: `${topic}.${ticker}`
							}))
						});
					}
					break;
				default:
					// console.log('agg', message);
					series[0].update({
						time: getLocalTime(message.s),
						open: message.o,
						high: message.h,
						low: message.l,
						close: message.c,
					});
					series[1].update({
						time: getLocalTime(message.s),
						value: message.v,
						color: message.o < message.c ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)',
					});
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
					/>
				<div id="chart" ref={div} />
			</SplitItem>
			{showDetails && 
				<SplitItem>
					<TickerDetails rest={rest} ticker={ticker} />
				</SplitItem>
			}
		</Split>
	);
}

