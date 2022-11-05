import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { isValidAPIKey, Signin } from './signin';
import { Chart } from './chart';
import { getCookie } from './cookies';
import { Router, route } from 'preact-router';
import { createHashHistory } from 'history';
import { toymd, isDark } from './helpers';
import './entry.css';

if (isDark()) {
	document.body.classList.replace('light', 'dark');
}

function getHashUrl() {
	const hash = location.href.replace(/^[^#]*/, '');
	return hash.substring(1, hash.length);
}

function Main() {
	const [apiKey, setAPIKey] = useState(getCookie('POLY_API_KEY'));
	const [preAuthUrl, setPreAuthUrl] = useState('');

	useEffect(() => {
		isValidAPIKey(apiKey).then(isValid => {
			if (isValid) {
				if (preAuthUrl.startsWith('/chart')) {
					route(preAuthUrl);
				} else {
					route(`/chart/AAPL/1/minute/${toymd(new Date())}`);
				}
			} else {
				setPreAuthUrl(getHashUrl());
				route('/signin');
			}
		});
	}, [apiKey]);

	const MyRouter = Router as any;
	const MyChart = Chart as any;
	return (
		<MyRouter history={createHashHistory()}>
			<div path="/">
				Checking API key
			</div>
			<Signin path="/signin" apiKey={apiKey} setAPIKey={setAPIKey} />
			<MyChart path="/chart/:ticker/:multiplier/:timespan/:date" apiKey={apiKey} />
		</MyRouter>
	);
}

render(<Main />, document.getElementById('app'));

