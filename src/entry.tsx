import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { isValidAPIKey, Signin } from './signin';
import { Chart } from './chart';
import { getCookie } from './cookies';
import './entry.css';

function Main() {
	const [apiKey, setAPIKey] = useState(getCookie('POLY_API_KEY'));
	const [view, setView] = useState('');

	useEffect(() => {
		isValidAPIKey(apiKey).then(isValid => {
			if (isValid) {
				setView('chart');
			} else {
				setView('signin');
			}
		});
	}, []);

	return (
		<>
			{view == '' && <div>Checking API key</div>}
			{view == 'signin' && <Settings apiKey={apiKey} setAPIKey={setAPIKey} />}
			{view == 'chart' && <Chart apiKey={apiKey} />}
		</>
	);
}

render(<Main />, document.getElementById('app'));



