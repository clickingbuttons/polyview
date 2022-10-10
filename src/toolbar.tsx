import { PriceScaleMode, DeepPartial, ChartOptions } from 'lightweight-charts';
import { useState, useEffect } from 'preact/hooks';
import { SymbolPicker } from './select';
import './toolbar.css';

export type Timespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
const timezones = [
	// This is actually browser-specific. Yikes!
	'America/New_York',
	'UTC'
];
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
	rest,
	showDetails,
	setShowDetails,
	showOverlay,
	setShowOverlay,
	timezone,
	setTimezone,
	showMarkers,
	setShowMarkers,
	onRefresh,
}) {
	const [percent, setPercent] = useState(false);
	const [dark, setDark] = useState(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

	useEffect(() => {
		setOptions({
			...(dark ? darkTheme : lightTheme),
			rightPriceScale: {
				mode: percent ? PriceScaleMode.Percentage : PriceScaleMode.Normal,
				scaleMargins: {
					top: 0.05,
					bottom: 0.2,
				}
			},
			leftPriceScale: {
				visible: true,
				borderColor: 'rgba(197, 203, 206, 1)',
				scaleMargins: {
					top: 0.85,
					bottom: 0.05
				}
			},
		} as DeepPartial<ChartOptions>);
	}, [percent, dark]);

	return (
		<div id="toolbar">
			<SymbolPicker value={ticker} onChange={newTicker => setTicker(newTicker)} rest={rest} />
			<input class="multiplier" min="1" onWheel={() => {}} type="number" value={multiplier} onChange={ev => setMultiplier(ev.target.value)} />
			<select value={timespan} onChange={ev => setTimespan(ev.target.value)}>
				{timespans.map(v =>
					<option value={v}>{v}</option>
				)}
			</select>
			<input value={date} onChange={ev => setDate(ev.target.value)} />

			<div class="toolbar-spacer" />

			<div class="toolbar-buttons" >
				<button title="Refresh" onClick={onRefresh}>
					<svg xmlns="http://www.w3.org/2000/svg" width="0.8rem" height="0.8rem" viewBox="0 0 383.748 383.748" style="enable-background:new 0 0 383.748 383.748;">
						<g>
							<path d="M62.772,95.042C90.904,54.899,137.496,30,187.343,30c83.743,0,151.874,68.13,151.874,151.874h30   C369.217,81.588,287.629,0,187.343,0c-35.038,0-69.061,9.989-98.391,28.888C70.368,40.862,54.245,56.032,41.221,73.593   L2.081,34.641v113.365h113.91L62.772,95.042z"/>
							<path d="M381.667,235.742h-113.91l53.219,52.965c-28.132,40.142-74.724,65.042-124.571,65.042   c-83.744,0-151.874-68.13-151.874-151.874h-30c0,100.286,81.588,181.874,181.874,181.874c35.038,0,69.062-9.989,98.391-28.888   c18.584-11.975,34.707-27.145,47.731-44.706l39.139,38.952V235.742z"/>
						</g>
					</svg>
				</button>
				<select value={timezone} onChange={ev => setTimezone(ev.target.value)}>
					{timezones.map(v =>
						<option value={v}>{v}</option>
					)}
				</select>
				<button title="Use % for price" onClick={() => setPercent(!percent)}>
					{percent ? <b>%</b> : '%'}
				</button>
				<button title="Live data" onClick={() => setLive(!live)}>
					{live ? <b>L</b> : 'L'}
				</button>
				<button title="Toggle dark mode" onClick={() => setDark(!dark)}>
					{dark ? <b>D</b> : 'D'}
				</button>
				<button title="Toggle OHLCV overlay" onClick={() => setShowOverlay(!showOverlay)}>
					{showOverlay ? <b>O</b> : 'O'}
				</button>
				<button title="Toggle display markers" onClick={() => setShowMarkers(!showMarkers)}>
					{showMarkers ? <b>M</b> : 'M'}
				</button>
				<button title="Toggle show details" onClick={() => setShowDetails(!showDetails)}>
					<svg xmlns="http://www.w3.org/2000/svg" width="0.8rem" height="0.8rem" viewBox="0 0 72 72">
						<g id="line">
							<line x1="16" x2="56" y1="26" y2="26" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/>
							<line x1="16" x2="56" y1="36" y2="36" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/>
							<line x1="16" x2="56" y1="46" y2="46" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2"/>
						</g>
					</svg>
				</button>
			</div>
		</div>
	);
}
