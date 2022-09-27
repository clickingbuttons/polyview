import { CandlestickData, createChart, UTCTimestamp, Time, ChartOptions, DeepPartial, IChartApi, ISeriesApi } from 'lightweight-charts';
import { restClient, websocketClient } from '@polygon.io/client-js';
import { useRef, useEffect, useState } from 'preact/hooks';
import { Toolbar, Timespan } from './toolbar';
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

export function Chart({ apiKey }) {
	const div = useRef();
	const rest = restClient(apiKey);
	let [chart, setChart] = useState(null as IChartApi);
	let [series, setSeries] = useState([] as ISeriesApi<any>[]);
	const [settings, setSettings] = useState({} as DeepPartial<ChartOptions>);
	const [live, setLive] = useState(false);
	const [ticker, setTicker] = useState('AAPL');
	const [multiplier, setMultiplier] = useState(1);
	const [timespan, setTimespan] = useState('minute' as Timespan);
	const [date, setDate] = useState(toymd(new Date()));
	const [data, setData] = useState([] as CandlestickData[]);
	const [scrollToStart, setScrollToStart] = useState(false);

	async function loadData(ticker: string, multiplier: number, timespan: string, date: string | number, loadForwards: boolean): Promise<CandlestickData[]> {
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

	useEffect(() => {
		series.forEach(s => chart.removeSeries(s));
		setSeries([]);
		loadData(ticker, multiplier, timespan, date, false)
			.then(candles => {
				setData(candles);
				setScrollToStart(true);
			});
	}, [ticker, multiplier, timespan, date]);

	useEffect(() => {
		if (data.length == 0) {
			return;
		}
		if (series.length == 0) {
			series.push(chart.addCandlestickSeries());
			series.push(chart.addHistogramSeries({
				lastValueVisible: false,
				priceLineVisible: false,
				priceFormat: {
					type: 'volume',
				},
				priceScaleId: 'left',
				scaleMargins: {
					top: 0.8,
					bottom: 0,
				},
			}));
			setSeries(series);
		}
		series[0].setData(data);
		series[1].setData(data);
		if (scrollToStart) {
			chart.timeScale().scrollToRealTime();
			setScrollToStart(false);
		}
	}, [data]);

	function onResize() {
		const ele = div.current as HTMLDivElement;
		// Bit of a hack since we know only chart + toolbar are on page.
		// Not sure a better way to handle resizing from tall to short since the 
		// chart decides to keep its height larger than its flexbox parent.
		const app = document.getElementById('app');
		const toolbar = document.getElementById('toolbar');
		chart.resize(ele.offsetWidth, app.offsetHeight - toolbar.offsetHeight, true);
	}

	useEffect(() => {
		if (!chart) {
			return;
		}
		let isLoading = false;
		function onRangeChange() {
			if (isLoading || data.length === 0 || series.length === 0) {
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
				//console.log('loading more bars before', new Date(epochMS).toISOString());
			} else {
				// TODO: get axis to not snap to newest date on load (which forces more data
				// to have to be loaded)
				isLoading = false;
				chart.applyOptions({ handleScroll: true });
				return;
				//epochMS = data[data.length - 1].time as number * 1000 + getLocalOffsetMS() + timespanMS;
				//console.log('need more bars after', new Date(epochMS).toISOString());
			}

			loadData(ticker, multiplier, timespan, epochMS, loadForwards)
				.then(newData => {
					//console.log('loaded', newData.length, 'more bars');
					if (loadBackwards) {
						setData([...newData, ...data]);
					} else {
						setData([...data, ...newData]);
					}
					isLoading = false;
					chart.applyOptions({ handleScroll: true });
				});
		}
		chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

		return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
	}, [ticker, multiplier, timespan, data]);

	useEffect(() => {
		if (!div.current) {
			return;
		}
		const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
		const darkTheme = {
			layout: {
				backgroundColor: '#2B2B43',
				lineColor: '#2B2B43',
				textColor: '#D9D9D9',
			},
			crosshair: {
				color: '#758696',
			},
			grid: {
				vertLines: {
					color: '#2B2B43',
				},
				horzLines: {
					color: '#363C4E',
				},
			},
		} as DeepPartial<ChartOptions>;
		const lightTheme = {
			layout: {
				backgroundColor: '#FFFFFF',
				lineColor: '#2B2B43',
				textColor: '#191919',
			},
			grid: {
				vertLines: {
					visible: false,
				},
				horzLines: {
					color: '#f0f3fa',
				},
			},
		} as DeepPartial<ChartOptions>;
		chart = createChart(div.current, {
			...(isDarkMode ? darkTheme: lightTheme),
			...(settings),
			timeScale: {
				timeVisible: true,
				secondsVisible: false,
			},
			localization: {
				locale: 'en',
				dateFormat: 'yyyy-MM-dd',
			},
		});
		setChart(chart);

		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	useEffect(() => {
		chart.applyOptions(settings);
	}, [settings]);

	useEffect(() => {
		if (live) {
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
							if (topic == 'XA') {
								// ...what a dumb decision to only allow XT:X:BTC-USD and not XT:X:BTCUSD
								rest.reference.tickerDetails(ticker)
									.then(ticker => {
										const { base_currency_symbol, currency_symbol } = ticker.results as any;
										client.send(JSON.stringify({
											action: "subscribe",
											params: `${topic}.X:${base_currency_symbol}-${currency_symbol}`
										}));
									})
							} else {
								client.send(JSON.stringify({
									action: "subscribe",
									params: `${topic}.${ticker}`
								}));
							}
						}
						break;
					default:
						console.log('agg', message);
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
		}
	}, [ticker, live]);

	return (
		<>
			<Toolbar
				setSettings={setSettings}
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
				/>
			<div id="chart" ref={div} />
		</>
	);
}

