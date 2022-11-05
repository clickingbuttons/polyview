import { PriceScaleMode, DeepPartial, ChartOptions } from 'lightweight-charts';
import { useState, useEffect } from 'preact/hooks';
import { SymbolPicker } from './select';
import { isDark, getDarkTheme, getLightTheme } from './helpers';
import { route } from 'preact-router';
import { Refresh, LightMode, DarkMode } from './icons';
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
					<Refresh />
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
				<button title={`Activate ${dark ? 'light' : 'dark'} mode`} onClick={() => setDark(!dark)}>
					{dark ? <LightMode /> : <DarkMode />}
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
