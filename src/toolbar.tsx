import { PriceScaleMode, DeepPartial, ChartOptions } from 'lightweight-charts';
import { useState, useEffect } from 'preact/hooks';

export function Toolbar({ loadData, setSettings, live, setLive, ticker, setTicker }) {
	const [multiplier, setMultiplier] = useState(1);
	const [timespan, setTimespan] = useState('minute');
	const today = new Date();
	const [to, setTo] = useState(today.toISOString().substring(0, 10));
	const [from, setFrom] = useState(new Date(today.setDate(today.getDate() - 7)).toISOString().substring(0, 10));
	const [percent, setPercent] = useState(false);

	useEffect(() => {
		loadData(ticker, multiplier, timespan, from, to);
	}, [ticker, multiplier, timespan, from, to]);

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
					top: 0.8,
					bottom: 0
				}
			},
		} as DeepPartial<ChartOptions>);
	}, [percent]);

	return (
		<div id="toolbar">
			<input value={ticker} onChange={ev => setTicker(ev.target.value)} />
			<input value={multiplier} onChange={ev => setMultiplier(ev.target.value)} />
			<input value={timespan} onChange={ev => setTimespan(ev.target.value)} />
			<input value={from} onChange={ev => setFrom(ev.target.value)} />
			<input value={to} onChange={ev => setTo(ev.target.value)} />
			<button onClick={() => setPercent(!percent)}>
				{(percent) ? <b>%</b> : '%'}
			</button>
			<button onClick={() => setLive(!live)}>
				{(live) ? <b>L</b> : 'L'}
			</button>
		</div>
	);
}
