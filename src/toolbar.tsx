import { PriceScaleMode, DeepPartial, ChartOptions } from 'lightweight-charts';
import { useState, useEffect } from 'preact/hooks';

export type Timespan = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
const timespans: Timespan[] = ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'];

export function Toolbar({
	setSettings,
	live,
	setLive,
	ticker,
	setTicker,
	multiplier,
	setMultiplier,
	timespan,
	setTimespan,
	date,
	setDate
}) {
	const [percent, setPercent] = useState(false);

	useEffect(() => {
		setSettings({
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
	}, [percent]);

	return (
		<div id="toolbar">
			<input value={ticker} onChange={ev => setTicker(ev.target.value)} />
			<input value={multiplier} onChange={ev => setMultiplier(ev.target.value)} />
			<select vlues={timespan} onChange={ev => setTimespan(ev.target.value)}>
				{timespans.map(v =>
					<option value={v}>{v}</option>
				)}
			</select>
			<input value={date} onChange={ev => setDate(ev.target.value)} />
			<button onClick={() => setPercent(!percent)}>
				{(percent) ? <b>%</b> : '%'}
			</button>
			<button onClick={() => setLive(!live)}>
				{(live) ? <b>L</b> : 'L'}
			</button>
		</div>
	);
}
