import { PriceScaleMode, DeepPartial, ChartOptions } from 'lightweight-charts';
import { useState, useEffect } from 'preact/hooks';
import { SymbolPicker } from './select';
import './toolbar.css';

export type Timespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
const timespans: Timespan[] = ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'];
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

export function Toolbar({
	setOptions,
	live,
	setLive,
	ticker,
	setTicker,
	multiplier,
	setMultiplier,
	timespan,
	setTimespan,
	date,
	setDate,
	rest
}) {
	const [percent, setPercent] = useState(false);
	const [dark, setDark] = useState(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

	useEffect(() => {
		setOptions({
			...(dark ? darkTheme : lightTheme),
			rightPriceScale: {
				mode: percent ? PriceScaleMode.Percentage : PriceScaleMode.Normal,
				scaleMargins: {
					top: 0,
					bottom: 0.2,
				}
			},
			leftPriceScale: {
				visible: true,
				borderColor: 'rgba(197, 203, 206, 1)',
				scaleMargins: {
					top: 0.85,
					bottom: 0
				}
			},
		} as DeepPartial<ChartOptions>);
	}, [percent, dark]);

	return (
		<div id="toolbar">
			<SymbolPicker value={ticker} onChange={newTicker => setTicker(newTicker)} rest={rest} />
			<input class="multiplier" min="1" onWheel={() => {}} type="number" value={multiplier} onChange={ev => setMultiplier(ev.target.value)} />
			<select vlues={timespan} onChange={ev => setTimespan(ev.target.value)}>
				{timespans.map(v =>
					<option value={v}>{v}</option>
				)}
			</select>
			<input value={date} onChange={ev => setDate(ev.target.value)} />

			<div class="toolbar-spacer" />

			<button onClick={() => setPercent(!percent)}>
				{percent ? <b>%</b> : '%'}
			</button>
			<button onClick={() => setLive(!live)}>
				{live ? <b>L</b> : 'L'}
			</button>
			<button onClick={() => setDark(!dark)}>
				{dark ? <b>D</b> : 'D'}
			</button>
		</div>
	);
}
