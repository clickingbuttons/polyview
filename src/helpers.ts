import { MouseEventParams, BarPrices, BarPrice } from 'lightweight-charts';
import { IRestClient } from '@polygon.io/client-js';
import { Timespan } from './toolbar';
import { getTimezoneOffset } from 'date-fns-tz';

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

export function convertTZ(date: Date, tzString: string): Date {
	const offsetMS = getTimezoneOffset(tzString, date);
	return new Date(date.getTime() + offsetMS);
}

export type Market = 'stocks' | 'options' | 'forex' | 'crypto';

export function getTickerMarket(ticker: string): Market {
	if (ticker.startsWith('X:')) {
		return 'crypto';
	} else if (ticker.startsWith('O:')) {
		return 'options';
	} else if (ticker.startsWith('C:')) {
		return 'forex';
	} else {
		return 'stocks';
	}
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
	time: number; // epoch MS
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	liquidity: number; // running calc for vwap
	vwap: number;
}

export function isMarketHoliday(d: Date): Boolean {
	// TODO: proper calendar
	if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
		return true;
	}

	return false;
}

const barsPageSize = 10000;
export async function fetchAggs(rest: IRestClient, ticker: string, multiplier: number, timespan: Timespan, date: string | number): Promise<Aggregate[]> {
	// Cleverness: desc + reverse
	const from = '1970-01-01';
	const to = String(date);
	return rest.stocks.aggregates(ticker, multiplier, timespan, from, to, { limit: barsPageSize, sort: 'desc' })
		.then(resp => {
			if (!resp.results || resp.results.length === 0)
				return [];

			// Normalize agg timestamp to 16:00 because Polygon returns 16:00 or 20:00
			if (timespan === 'day')  {
				resp.results.forEach(agg => {
					agg.t = toStartOfTimespan(agg.t, timespan, multiplier) + getTimespanMS('hour') * 20;
				});
			}
			const firstMS = resp.results[resp.results.length - 1].t;
			const lastMS = resp.results[0].t;
			console.log(firstMS, lastMS);
			const res = [] as Aggregate[];

			const market = getTickerMarket(ticker);
			let j = resp.results.length - 1;
			for (var ms = firstMS; ms <= lastMS; ms += getTimespanMS(timespan) * multiplier) {
				const bar = resp.results[j];
				const barMatches = bar.t === ms;

				if (market === 'stocks') {
					const offsetMS = getTimezoneOffset('America/New_York', ms);
					const date = new Date(ms + offsetMS);
					if (['minute', 'hour', 'day'].includes(timespan)) {
						if (isMarketHoliday(date)) {
							if (barMatches) {
								console.error('agg returned on holiday', date.getTime(), bar);
							}
							continue;
						}
					}
					if (['minute', 'hour'].includes(timespan)) {
						const hour = date.getUTCHours();
						if (hour < 4 || hour >= 20) {
							if (barMatches) {
								console.error('agg returned during market close', date.getTime(), bar);
							}
							continue;
						}
					}
				}

				const newBar = {
					time: ms,
				} as Aggregate;
				if (barMatches) {
					// for candlestick series
					newBar.time = bar.t,
					newBar.open = bar.o;
					newBar.high = bar.h;
					newBar.low = bar.l;
					newBar.close = bar.c;
					newBar.volume = bar.v;
					newBar.vwap = bar.vw;

					j -= 1;
				}
				res.push(newBar);
			}

			console.log(res, resp.results);
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
			case 'Line':
				value = value as BarPrice;
				overlay.vwap = value;
				break;
			default:
				console.log('unknown series type', key.seriesType());
		}
	});
	if (overlay.open) {
		const precision = 2;
		return `O: ${overlay.open.toFixed(precision)
		} H: ${overlay.high.toFixed(precision)
		} L: ${overlay.low.toFixed(precision)
		} C: ${overlay.close.toFixed(precision)
		}`;
		// %: ${((overlay.close - overlay.open) / overlay.open * 100).toFixed(precision)
		// } Li: $${humanQuantity(overlay.vwap * overlay.volume)}`
	}

	return '';
}

export function toStartOfTimespan(epochMS: number, timespan: Timespan, multiplier: number): number {
	let truncation = getTimespanMS(timespan) * multiplier;
	return Math.trunc(epochMS / truncation) * truncation;
}

export function aggBar(lastBar: Aggregate, epochMS: number, price: number, size: number, timespan: Timespan, multiplier: number): Aggregate {
	const time = toStartOfTimespan(epochMS, timespan, multiplier);
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

export interface Trade {
	ts: number;
	price: number;
	size: number;
	conditions: number[];
}

export function isEligible(t: Trade): Boolean {
	return true;
}

// Assumes all trades are in window.
export function aggTrades(trades: Trade[], time: number): Aggregate | undefined {
	let res = {} as Aggregate;

	trades.filter(isEligible).forEach(t => {
		if (res.open === 0) {
			res = {
				time: time,
				open: t.price,
				high: t.price,
				low: t.price,
				close: t.price,
				volume: t.size,
				liquidity: t.size * t.price,
				vwap: t.price,
			};
		} else {
			res.liquidity += t.size * t.price;
			res.volume += t.size;
			res.vwap = res.liquidity / res.volume;
			res.close = t.price;
			if (t.price > res.high) {
				res.high = t.price;
			} else if (t.price < res.low) {
				res.low = t.price;
			}
		}
	});

	return res.open ? res : undefined;
}

