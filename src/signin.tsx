import { setCookie } from './cookies';
import { restClient } from "@polygon.io/client-js";
import { useState } from 'preact/hooks';

export async function isValidAPIKey(apiKey: string): Promise<Boolean> {
	const client = restClient(apiKey);
	return client.reference.tickerDetails('AAPL')
		.then(() => true)
		.catch(() => false);
}

export function Signin({ path, apiKey, setAPIKey }) {
	const [error, setError] = useState('');

	function onSubmit(ev: FormDataEvent) {
		ev.preventDefault();
		isValidAPIKey(apiKey).then(res => {
			if (res) {
				setError('');
				setCookie('POLY_API_KEY', apiKey);
			} else {
				setError('invalid api key');
			}
		});
	}

	return (
		<form onSubmit={onSubmit}>
			<label for="apiKey">Polygon API key</label>
			<input type="text" value={apiKey} onChange={ev => setAPIKey(ev.target.value)}></input>
			<input type="submit" value="Submit" />
			<br />
			<br />
			<div>This is the only cookie saved on this site. Lasts forever.</div>
			<div>{error}</div>
		</form>
	);
}

