import { createChart, ChartOptions, DeepPartial, IChartApi, MouseEventParams, UTCTimestamp, SeriesMarker, Time } from 'lightweight-charts';
import { restClient, websocketClient } from '@polygon.io/client-js';
import { useRef, useEffect, useState, useMemo } from 'preact/hooks';
import { Toolbar} from './toolbar';
import { Split, SplitItem } from './split';
import { TickerDetails } from './tickerdetails';
import { fetchAggs, getTimespanMS, getWSTicker, getOverlay, Aggregate, aggBar, getTickerMarket, convertTZ } from './helpers';
import { SeriesPicker, updateTickerSeriesData, TickerSeries, toHistogram, toCandlestickData } from './seriespicker';
import { GotoRecent } from './icons';
import './chart.css';

export function Chart({
	path,
	apiKey,
	/* from url */
	ticker,
	multiplier,
	timespan,
	date
}) {
	// lightweight-charts
	const div = useRef();
	const [chart, setChart] = useState(null as IChartApi);
	const [options, setOptions] = useState({} as DeepPartial<ChartOptions>);
	let [tickerSeries, setTickerSeries] = useState({ ticker, series: [] } as TickerSeries);

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
	const [timezone, setTimezone] = useState('America/New_York');
	const [showDetails, setShowDetails] = useState(true || window.innerWidth > 1400);
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
	multiplier = +multiplier;
	if (Number.isNaN(multiplier)) {
		setStatus(`Invalid multiplier ${multiplier}`);
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
					updateTickerSeriesData(tickerSeries, candles, timezone, true);
				}
				setStatus('');
			});
	}

	// Update markers
	useEffect(() => {
		if (!showMarkers && tickerSeries.series.length > 0) {
			tickerSeries.series[0].series.setMarkers([]);
			return;
		}
		if (aggs.length === 0 || tickerSeries.series.length === 0 || !showMarkers || getTickerMarket(ticker) !== 'stocks') {
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
						text: `${s.split_from} for ${s.split_to} split`
					} as SeriesMarker<Time>));
			}
			if (dividends.results) {
				dividends.results
					.forEach(d => markers.push({
						time: convertTZ(new Date(d.ex_dividend_date), timezone).getTime() / 1000 as UTCTimestamp,
						position: 'aboveBar',
						shape: 'arrowDown',
						text: `${d.dividend_type} ${d.cash_amount}`
					} as SeriesMarker<Time>));
			}

			markers = markers
				.filter(m => {
					const epochMS = m.time as number * 1000;
					return epochMS > aggs[0].time && epochMS < aggs[aggs.length - 1].time;
				})
				.sort((a, b) => a.time > b.time ? 1 : -1);
			tickerSeries.series[0].series.setMarkers(markers);
		});
	}, [ticker, tickerSeries, aggs, showMarkers]);

	useEffect(() => {
		if (!chart) {
			return;
		}
		if (aggs.length === 0) {
			tickerSeries.series.forEach(s => chart.removeSeries(s.series));
			tickerSeries.series = [];
			setTickerSeries(tickerSeries);
		}
		if (tickerSeries.series.length === 0) {
			tickerSeries.series.push({
				series: chart.addCandlestickSeries(),
				transformer: toCandlestickData,
			});
			tickerSeries.series.push({
				series: chart.addHistogramSeries({
					lastValueVisible: false,
					priceLineVisible: false,
					priceFormat: {
						type: 'volume',
					},
					priceScaleId: 'left',
				}),
				transformer: toHistogram,
			});
			setTickerSeries(tickerSeries);
		}
		updateTickerSeriesData(tickerSeries, aggs, timezone, false);
		if (fitContent) {
			chart.timeScale().fitContent();
			setFitContent(false);
			setReachedEnd(false);
		}
	}, [aggs, tickerSeries, timezone]);

	// infinite scrolling back
	const [reachedEnd, setReachedEnd] = useState(false);

	useEffect(() => {
		if (!chart) {
			return;
		}
		let isLoading = false;
		function onRangeChange() {
			if (isLoading || aggs.length === 0 || tickerSeries.series.length === 0 || reachedEnd) {
				return;
			}
			const logicalRange = chart.timeScale().getVisibleLogicalRange();
			const barsInfo = tickerSeries.series[0].series.barsInLogicalRange(logicalRange);
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
				setStatus(`Loading before ${new Date(epochMS).toISOString().substring(0, 10)}...`);
			} else {
				isLoading = false;
				chart.applyOptions({ handleScroll: true });
				return;
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
					tickerSeries[0].update({
						time: time,
						open: message.o,
						high: message.h,
						low: message.l,
						close: message.c,
						color: color,
					});
					tickerSeries[1].update({
						time: time,
						value: message.v,
						color: color,
					});
					tickerSeries[2].update({
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
					updateTickerSeriesData(tickerSeries, [newBar], timezone, true);
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
	}, [tickerSeries, live]);

	return (
		<Split>
			<SplitItem>
				<Toolbar
					setOptions={setOptions}
					live={live}
					setLive={setLive}
					ticker={ticker}
					multiplier={multiplier}
					timespan={timespan}
					date={date}
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
										<GotoRecent />
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</SplitItem>
			{showDetails && 
				<div class="sidepanel">
					<SplitItem>
						<TickerDetails rest={rest} ticker={ticker} />
						<SeriesPicker rest={rest} ticker={ticker} chart={chart} series={tickerSeries} setSeries={setTickerSeries} />
					</SplitItem>
				</div>
			}
		</Split>
	);
}

