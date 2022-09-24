import { getCookie, setCookie } from './cookies';
import { version, widget, ResolutionString } from '../static/tradingview';
import { Datafeed, isValidAPIKey } from './datafeed';

function initChart(apiKey: string) {
	const isDarkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

	new widget({
		//debug: true,
		fullscreen: true,
		symbol: 'AAPL',
		interval: '1' as ResolutionString,
		container: 'chart',
		datafeed: new Datafeed(apiKey),
		library_path: 'tradingview/',
		locale: 'en',
		disabled_features: [],
		enabled_features: [],
		theme: isDarkMode ? 'Dark' : 'Light',
		timezone: 'America/New_York',
	});
}

async function main() {
	console.log('tradingview version', version());
	let apiKey = getCookie('POLY_API_KEY');

	if (!await isValidAPIKey(apiKey)) {
		const signin = document.getElementById('signin') as HTMLFormElement;
		const input = document.getElementById('apiKey') as HTMLInputElement;
		const error = document.getElementById('error') as HTMLDivElement;

		signin.removeAttribute('hidden');
		signin.addEventListener('submit', async ev => {
			ev.preventDefault();
			apiKey = input.value;
			if (await isValidAPIKey(apiKey)) {
				setCookie('POLY_API_KEY', apiKey);
				signin.setAttribute('hidden', '');
				initChart(apiKey);
				error.innerText = '';
			} else {
				error.innerText = `Invalid key ${apiKey}`;
			}
		});
	} else {
		initChart(apiKey);
	}
}

main();
