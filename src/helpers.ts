import { UTCTimestamp, MouseEventParams, BarPrices, BarPrice } from 'lightweight-charts';
import { IRestClient } from '@polygon.io/client-js';
import { Timespan } from './toolbar';

function humanize(val: number, scale: string[]) {
	const thresh = 1000;
	if (val < thresh)
		return val;

	let log_10 = -1;
	do {
			val /= thresh;
			++log_10;
	} while(val >= thresh);

	return val.toFixed(1) + ' ' + scale[log_10];
}

export function humanQuantity(val: number) {
	return humanize(val, [
		'thousand',
		'million',
		'billion',
		'trillion',
		'quadrillion',
		'quintillion',
		'sextillion',
		'septillion',
	]);
};

export function _getLocalOffsetMS(date: Date): number {
	return date.getTimezoneOffset() * 60 * 1000;
}

export function _getLocalTime(epochMS: number): UTCTimestamp {
	const date = new Date(epochMS);
	return (date.getTime() - _getLocalOffsetMS(date)) / 1000 as UTCTimestamp;
}

export function toymd(date: Date) {
	return date.toISOString().substring(0, 10);
}

export function getTimespanMS(timespan: Timespan): number {
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

export type Aggregate = {
	time: UTCTimestamp;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	liquidity: number; // running calc for vwap
	vwap: number;
}

const barsPageSize = 10000;
export async function loadData(rest: IRestClient, ticker: string, multiplier: number, timespan: Timespan, date: string | number): Promise<Aggregate[]> {
	console.log('loadData', date);
	// Cleverness: desc + reverse
	const from = '1970-01-01';
	const to = String(date);
	return rest.stocks.aggregates(ticker, multiplier, timespan, from, to, { limit: barsPageSize, sort: 'desc' })
		.then(resp => {
			if (!resp.results || resp.results.length === 0)
				return [];

			// Normalize agg timestamp because Polygon sometimes returns daily bars at
			// 16:00 and sometimes at 20:00
			const timespanMS = getTimespanMS(timespan) * multiplier;
			resp.results.forEach(b => b.t = Math.trunc(b.t / timespanMS) * timespanMS);

			const firstMS = resp.results[resp.results.length - 1].t;
			const lastMS = resp.results[0].t;
			console.log(firstMS, lastMS);
			const nBars = (lastMS - firstMS) / timespanMS + 1;
			console.log('got', resp.results.length, '/', nBars, 'aggs');
			const res = Array(nBars).fill({} as Aggregate);
			
			let j = resp.results.length - 1;
			for (let i = 0; i < res.length; i++) {
				const aggMS = firstMS + i * timespanMS;
				const bar = resp.results[j];
				bar.t = Math.trunc(bar.t / timespanMS) * timespanMS;
				res[i] = {
					time: (aggMS / 1000) as UTCTimestamp,
				};
				if (bar.t === aggMS) {
					// for candlestick series
					res[i].open = bar.o;
					res[i].high = bar.h;
					res[i].low = bar.l;
					res[i].close = bar.c;
					res[i].volume = bar.v;
					res[i].vwap = bar.vw;

					// Optimization for candlestick + volume
					res[i].value = bar.v;
					res[i].color = bar.o < bar.c ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)';

					j -= 1;
				}
			}

			return res;
		});
}

export async function getWSTicker(rest: IRestClient, ticker: string): Promise<string> {
	if (ticker.startsWith('X')) {
		// ...polygon only allows XT:X:BTC-USD and not XT:X:BTCUSD :(
		return rest.reference.tickerDetails(ticker)
			.then(ticker => {
				const { base_currency_symbol, currency_symbol } = ticker.results as any;
				return `X:${base_currency_symbol}-${currency_symbol}`
			})
	} else {
		return `${ticker}`
	}
}

export function getOverlay(hover: MouseEventParams) {
	if (!hover.seriesPrices) {
		return '';
	}
	let overlay: Partial<Aggregate> = {};
	hover.seriesPrices.forEach((value, key) => {
		switch (key.seriesType()) {
			case 'Candlestick':
				value = value as BarPrices;
				overlay.open = value.open;
				overlay.high = value.high;
				overlay.low = value.low;
				overlay.close = value.close;
				break;
			case 'Histogram':
				value = value as BarPrice;
				overlay.volume = value;
				break;
		}
	});
	if (overlay.open) {
		const precision = 2;
		return `O: ${overlay.open.toFixed(precision)
		} H: ${overlay.high.toFixed(precision)
		} L: ${overlay.low.toFixed(precision)
		} C: ${overlay.close.toFixed(precision)
		} %: ${((overlay.close - overlay.open) / overlay.open * 100).toFixed(precision)
		} V: $${overlay.volume}`
	}

	return '';
}

export function toStartOfTimespan(epochMS: number, timespan: Timespan, multiplier: number): number {
	let truncation = getTimespanMS(timespan) * multiplier;
	return epochMS - (epochMS % truncation);
}

export function aggBar(lastBar: Aggregate, epochMS: number, price: number, size: number, timespan: Timespan, multiplier: number, isStock: bool): Aggregate {
	const time = getLocalTime(toStartOfTimespan(epochMS, timespan, multiplier));
	if (lastBar.time === time) {
		return {
			time: time,
			open: lastBar.open,
			high: lastBar.high,
			low: lastBar.low,
			close: price,
			volume: lastBar.volume + size,
			liquidity: lastBar.liquidity,
			vwap: (lastBar.liquidity + price * size) / (lastBar.volume + size)
		};
	}
	return {
		time: time,
		open: price,
		high: price,
		low: price,
		close: price,
		volume: size,
		liquidity: price * size,
		vwap: price,
	};
}
