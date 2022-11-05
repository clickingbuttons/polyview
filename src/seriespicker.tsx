import { ISeriesApi, CandlestickData, HistogramData, UTCTimestamp, SeriesType, SeriesDataItemTypeMap, LineData } from 'lightweight-charts';
import { SymbolPicker } from './select';
import { Aggregate, convertTZ } from './helpers';
import './seriespicker.css';

export interface Series<T extends SeriesType> {
	series: ISeriesApi<T>;
	transformer: (agg: Aggregate) => SeriesDataItemTypeMap[T];
}

export interface TickerSeries {
	ticker: string;
	series: Series<any>[];
}

export function toCandlestickData(a: Aggregate): CandlestickData {
	const res = a as unknown /* for time: UTCTimestamp */ as CandlestickData;
	if (res.open) {
		res.color = a.open < a.close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
	}
	return res;
}

export function toHistogram(a: Aggregate): HistogramData {
	const res = { time: a.time } as HistogramData;
	if (a.volume) {
		res.value = a.volume;
		res.color = a.open < a.close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';
	}
	return res;
}

export function toVWAP(a: Aggregate): LineData {
	const res = { time: a.time } as HistogramData;
	if (a.vwap) {
		res.value = a.vwap;
		res.color = 'purple';
	}
	return res;
}

// Update series + view + crosshair
export function updateTickerSeriesData(series: TickerSeries, newAggs: Aggregate[], timezone: string, update: Boolean) {
	// convert ts
	const timezoneAggs = newAggs.map(agg => ({
		...agg,
		time: convertTZ(new Date(agg.time), timezone).getTime() / 1000 as UTCTimestamp,
	}));
	series.series.forEach(s => {
		if (update) {
			timezoneAggs.forEach(a => s.series.update(s.transformer(a)));
		} else {
			s.series.setData(timezoneAggs.map(s.transformer));
		}
	});
}

function reducer (prev: [string, string][], [key, val]: [ key: string, val: any ]) {
	const keys = typeof(val) === 'string' ? [] : Object.entries(val).map(([key2, val2]) => {
		prev.push([key + '.' + key2, val2]);
		return 1;
	});
	if (keys.length === 0) {
		prev.push([key, val]);
	}
	return prev;
}

function makeInput(key: string, val: any, s: Series<any>) {
	let t = 'text';
	if (typeof val === 'number') {
		t = 'number';
	} else if (typeof val === 'string' && val.length > 0 && val[0] === '#') {
		t = 'color';
	} else if (typeof val === 'boolean') {
		t = 'checkbox';
	}

	return (
		<input
			type={t}
			onChange={ev => {
				let newVal = ev.target.value;
				if (t === 'number') {
					newVal = +newVal;
				} else if (t === 'checkbox') {
					newVal = Boolean(ev.target.checked);
				}
				console.log(newVal);
				if (key.includes('.')) {
					const split = key.split('.');
					s.series.applyOptions({
						[split[0]]: {
							[split[1]]: newVal
						}
					});
				} else {
					console.log({[key]: newVal});
					s.series.applyOptions({[key]: newVal});
				}
			}}
			checked={val}
			value={val}
		/>	
	);
}

export function SeriesPicker({
	rest,
	ticker,
	chart,
	series,
	setSeries,
	style = {},
}) {
	let ss = series as TickerSeries;

	function addVWAP() {
		ss.series.push({
			series: chart.addLineSeries(),
			transformer: toVWAP,
		});
		setSeries({ ...ss });
	}

	function onRemove(s: Series<any>) {
		ss.series = ss.series.filter(a => a !== s);
		chart.removeSeries(s.series);
		setSeries({ ...ss });
	}

	return (
		<div class="seriesPicker" style={style}>
			<h2 class="sidepanel-h2">Series Picker</h2>
			<SymbolPicker value={ss.ticker} onChange={() => {}} disabled={ticker === ss.ticker} rest={rest} />
			<br />
			<button onClick={addVWAP}>
				add vwap
			</button>
			{ss.series.map(s => (
				<div class="seriesSettings">
					<b>{s.series.seriesType()}</b>
					<button onClick={() => onRemove(s)}>
						Remove
					</button>
					<form class="series-form">
						<table>
							<colgroup>
								 <col span="1" style="width: 150px;" />
								 <col span="1" style="width: 100%;" />
							</colgroup>
							{Object.entries(s.series.options())
								.reduce(reducer, [])
								.map(([key, val]) => (
									<tr>
										<td>
											<p class="truncate">
												{key}
											</p>
										</td>
										<td align="right">
											{makeInput(key, val, s)}
										</td>
									</tr>
								))
							}
						</table>
					</form>
				</div>
			))}
		</div>
	);
}
