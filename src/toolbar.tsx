import { PriceScaleMode, DeepPartial, ChartOptions } from 'lightweight-charts';
import { useState, useEffect } from 'preact/hooks';
import { SymbolPicker } from './select';
import { isDark, getDarkTheme, getLightTheme } from './helpers';
import { route } from 'preact-router';
import './toolbar.css';

export type Timespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
const timezones = [
	// This is actually browser-specific. Yikes!
	'America/New_York',
	'UTC'
];
const timespans: Timespan[] = ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'];

export function Toolbar({
	setOptions,
	ticker,
	multiplier,
	timespan,
	date,
	rest,
	live,
	setLive,
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
	const [dark, setDark] = useState(isDark());

	useEffect(() => {
		if (dark)
			document.body.classList.replace('light', 'dark');
		else
			document.body.classList.replace('dark', 'light');
		setOptions({
			...(dark ? getDarkTheme() : getLightTheme()),
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

	function setRoute({ tick = ticker, mult = multiplier, time = timespan, d = date }) {
		route(`/chart/${tick}/${mult}/${time}/${d}`);
	}

	return (
		<div id="toolbar">
			<SymbolPicker value={ticker} onChange={newTicker => setRoute({ tick: newTicker })} rest={rest} />
			<input class="multiplier" min="1" onWheel={() => {}} type="number" value={multiplier} onChange={ev => setRoute({ mult: ev.target.value})} />
			<select value={timespan} onChange={ev => setRoute({ time: ev.target.value })}>
				{timespans.map(v =>
					<option value={v}>{v}</option>
				)}
			</select>
			<input value={date} onChange={ev => setRoute({ d: ev.target.value })} />

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
					{showDetails ? <b>{'<'}</b> : '>'}
				</button>
			</div>
		</div>
	);
}
