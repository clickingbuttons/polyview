import { CandlestickData, createChart, UTCTimestamp, ChartOptions, DeepPartial, IChartApi, ISeriesApi } from 'lightweight-charts';
import { restClient, websocketClient } from '@polygon.io/client-js';
import { useRef, useEffect, useState } from 'preact/hooks';
import { Toolbar } from './toolbar';
import './chart.css';

function getLocalTime(epochMS: number): UTCTimestamp {
	return (epochMS + (new Date().getTimezoneOffset()) * 60 * 1000) / 1000 as UTCTimestamp;
}

export function Chart({ apiKey }) {
	const div = useRef();
	const rest = restClient(apiKey);
	let [chart, setChart] = useState(null as IChartApi);
	let [series, setSeries] = useState([] as ISeriesApi<any>[]);
	const [settings, setSettings] = useState({} as DeepPartial<ChartOptions>);
	const [live, setLive] = useState(false);
	const [ticker, setTicker] = useState('X:BTCUSD');

	function loadData(ticker: string, multiplier: number, timespan: string, from: string, to: string) {
		rest.stocks.aggregates(ticker, multiplier, timespan, from, to, { limit: 50000 })
			.then(res => res.results && res.results.map(bar => ({
				// for candlestick series
				time: getLocalTime(bar.t),
				open: bar.o,
				high: bar.h,
				low: bar.l,
				close: bar.c,

				// for histogram series (also uses time)
				value: bar.v,
				color: bar.o < bar.c ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)',
			} as CandlestickData)))
			.then(candles => {
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
				series[0].setData(candles || []);
				series[1].setData(candles || []);
			});
	}

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
				loadData={loadData}
				setSettings={setSettings}
				live={live}
				setLive={setLive}
				ticker={ticker}
				setTicker={setTicker}
				/>
			<div id="chart" ref={div} />
		</>
	);
}

