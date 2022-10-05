import { CandlestickData, UTCTimestamp, MouseEventParams, BarPrices, BarPrice } from 'lightweight-charts';
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

export function getLocalOffsetMS(date: Date): number {
	return date.getTimezoneOffset() * 60 * 1000;
}

export function getLocalTime(epochMS: number): UTCTimestamp {
	const date = new Date(epochMS);
	return (date.getTime() - getLocalOffsetMS(date)) / 1000 as UTCTimestamp;
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
export async function loadData(rest: IRestClient, ticker: string, multiplier: number, timespan: string, date: string | number, loadForwards: boolean): Promise<Aggregate[]> {
	// Cleverness: desc + reverse
	const from = loadForwards ? String(date) : '1970-01-01';
	const to = loadForwards ? '2100-01-01' : String(date);
	return rest.stocks.aggregates(ticker, multiplier, timespan, from, to, { limit: barsPageSize, sort: loadForwards ? 'asc' : 'desc' })
		.then(res => {
			if (!res.results)
				return [];

			return res.results.map(bar => ({
				// for candlestick series
				time: getLocalTime(bar.t),
				open: bar.o,
				high: bar.h,
				low: bar.l,
				close: bar.c,
				volume: bar.v,
				liquidity: bar.vw * bar.v,
				vwap: bar.vw,

				// Shortcut for candlestick + volume
				value: bar.v,
				color: bar.o < bar.c ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)',
			}))
		})
		.then(candles => loadForwards ? candles : candles.reverse());
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
