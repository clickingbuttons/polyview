import { restClient, IRestClient } from "@polygon.io/client-js";
import { MarketType } from "@polygon.io/client-js/lib/rest/reference/tickers";
import * as tv from '../static/tradingview';

export async function isValidAPIKey(apiKey: string): Promise<Boolean> {
	const client = restClient(apiKey);
	return client.stocks.aggregates('AAPL', 1, 'minute', '2021-07-22', '2021-07-22')
		.then(() => true)
		.catch(() => false);
}

export class Datafeed implements tv.IExternalDatafeed, tv.IDatafeedChartApi {
	rest: IRestClient;
	static resolutions = ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M', '12M'] as unknown as tv.ResolutionString[];
	static startOfData = new Date('2003-09-10').getTime();

	constructor(apiKey: string) {
		this.rest = restClient(apiKey);
	}

	static getType(market: MarketType): string {
		switch (market) {
			case "stocks":
				return "stock";
			case "crypto":
				return "crypto";
			case "fx":
				return "fx";
		}
	}

	static getSession(market: MarketType): string {
		switch (market) {
			case "stocks":
				return '0400-2000';
			case "crypto":
			case "fx":
				return '24x7';
		}
	}

	async getExchanges(): Promise<tv.Exchange[]> {
		const exchanges = await this.rest.reference.exchanges();
		return exchanges.results.map(e => ({
			value: e.mic,
			name: e.name,
			desc: `${e.locale} ${e.asset_class} ${e.type}`
		}));
	}

	onReady(callback: tv.OnReadyCallback) {
		this.getExchanges()
			.then(exchanges => callback({
				 exchanges: exchanges,
				 supported_resolutions: Datafeed.resolutions,
				 currency_codes: ['USD'],
				 supports_marks: false,
				 supports_time: false,
				 supports_timescale_marks: false,
				 symbols_types: [],
			 })
			);
	}

	searchSymbols(userInput: string, _exchange: string, _symbolType: string, onResult: tv.SearchSymbolsCallback): void {
		//console.log('search', arguments);
		this.rest.reference.tickers({
			search: userInput,
			limit: 20,
		})
			.then(res => res.results)
			.then(res => res.map(r => ({
				symbol: r.ticker,
				full_name: r.name,
				description: r.name,
				exchange: r.primary_exchange,
				ticker: r.ticker,
				type: r.type,
			} as tv.SearchSymbolResultItem)))
			.then(res => onResult(res))
			.catch(err => {
				console.error(err);
				onResult([]);
			});
	}

	resolveSymbol(symbolName: string, onResolve: tv.ResolveCallback, onError: tv.ErrorCallback, _extension?: tv.SymbolResolveExtension): void {
		//console.log('resolve', arguments);
		this.rest.reference.tickerDetails(symbolName)
			.then(res => res.results)
			.then(res => onResolve({
				ticker: res.ticker,
				name: res.ticker,
				full_name: res.name,
				exchange: res.primary_exchange,
				listed_exchange: res.primary_exchange,
				currency_code: res.currency_name,
				format: 'price',
				description: res.name,
				minmov: 1,
				pricescale: 100,
				session: Datafeed.getSession(res.market as MarketType),
				has_daily: true,
				has_intraday: true,
				has_ticks: false,
				has_weekly_and_monthly: true,
				has_empty_bars: false,
				has_seconds: false,
				visible_plots_set: 'ohlcv',
				supported_resolutions: Datafeed.resolutions,
				timezone: 'America/New_York',
				type: Datafeed.getType(res.market as MarketType),
			}))
			.catch(err => onError(err));
	}

	static getPeriod(resolution: tv.ResolutionString): { multiplier: number, timespan: string } {
		let timespan = 'minute';
		let multiplier = 1;
		if (resolution == '60') {
			resolution = '1H' as tv.ResolutionString;
		} else if (resolution == '120') {
			resolution = '2H' as tv.ResolutionString;
		}
		const lastChar = resolution[resolution.length - 1];
		if (!(lastChar >= '0' && lastChar <= '9')) {
			multiplier = parseInt(resolution.substring(0, resolution.length - 1));
			if (Number.isNaN(multiplier)) {
				return { timespan: '', multiplier: 0 };
			}
			switch (lastChar) {
				case 'H':
					timespan = 'hour';
					break;
				case 'D':
					timespan = 'day';
					break;
				case 'W':
					timespan = 'week';
					break;
				case 'M':
					timespan = 'month';
					break;
				case 'Y':
					timespan = 'year';
					break;
			}
		}

		return { timespan, multiplier };
	}

	getBars(symbolInfo: tv.LibrarySymbolInfo, resolution: tv.ResolutionString, periodParams: tv.PeriodParams, onResult: tv.HistoryCallback, onError: tv.ErrorCallback): void {
		//console.log('getBars', new Date(periodParams.from * 1000), new Date(periodParams.to * 1000));
		const { multiplier, timespan } = Datafeed.getPeriod(resolution);
		let from = periodParams.from * 1000;
		let to = periodParams.to * 1000;
		if (to < Datafeed.startOfData) {
			onResult([], { noData: true });
			return;
		}
		console.log(resolution, multiplier, timespan, periodParams.countBack, new Date(from), new Date(to))
		this.rest.stocks.aggregates(
			symbolInfo.ticker,
			multiplier,
			timespan,
			String(from),
			String(to),
			{
				limit: periodParams.countBack + 100,
				sort: 'desc',
				adjusted: 'true',
			},
		)
			.then(res => {
				if (!res.results) {
					//console.log('empty res', symbolInfo.ticker, multiplier, timespan, from, to);
					return [];
				} else {
					return res.results.map(t => ({
						time: t.t,
						open: t.o, 
						high: t.h, 
						low: t.l, 
						close: t.c, 
						volume: t.v,
					} as tv.Bar)).reverse();
				}
			})
			.then(bars => {
				//console.log('onResult', bars.length);
				onResult(bars);
			})
			.catch(err => onError(err));
	}

	subscribeBars(symbolInfo: tv.LibrarySymbolInfo, resolution: tv.ResolutionString, onTick: tv.SubscribeBarsCallback, listenerGuid: string, onResetCacheNeededCallback: () => void): void {
		console.log('subscribeBars', arguments);
	}

	unsubscribeBars(listenerGuid: string): void {
		console.log('unsubscribeBars', arguments);
	}
};

