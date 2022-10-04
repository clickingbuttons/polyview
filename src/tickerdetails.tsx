import { IRestClient, ITickerDetails } from '@polygon.io/client-js';
import { useEffect, useState } from 'preact/hooks';
import './tickerdetails.css';

type TickerDetailsProps = {
	rest: IRestClient,
	ticker: string
};

const units = [
	'thousand',
	'million',
	'billion',
	'trillion',
	'quadrillion',
	'quintillion',
	'sextillion',
	'septillion',
];
const thresh = 1000;
function humanQuantity(val: number) {
    if (val < thresh)
			return val;

    let log_10 = -1;
    do {
        val /= thresh;
        ++log_10;
    } while(val >= thresh);

    return val.toFixed(1) + ' ' + units[log_10];
};

export function TickerDetails({ rest, ticker }: TickerDetailsProps) {
	const [details, setDetails] = useState({} as ITickerDetails['results']);

	useEffect(() => {
		rest.reference.tickerDetails(ticker).then(res => setDetails(res.results));
	}, []);
	console.log(details);

	return (
		<div class="tickerdetails">
			<h2>{ticker}</h2>
			<table>
				<tr><td>Root ticker</td><td>{(details as any).ticker_root}</td></tr>
				<tr>
					<td>Name</td>
					<td>
						{details.homepage_url
							? <a href={details.homepage_url}>{details.name}</a>
							: details.name
						}
					</td>
				</tr>
				<tr><td>Type</td><td>{details.type}</td></tr>
				<tr><td>Listing exchange</td><td>{details.primary_exchange}</td></tr>
				<tr><td>List date</td><td>{details.list_date || ''}</td></tr>
				<tr><td>FIGI</td><td>{details.share_class_figi || ''}</td></tr>
				<tr><td>CIK</td><td>{details.cik || ''}</td></tr>
				<tr><td>Share class shares</td><td>{humanQuantity(details.share_class_shares_outstanding)}</td></tr>
				<tr><td>Weighted shares</td><td>{humanQuantity(details.weighted_shares_outstanding)}</td></tr>
				<tr><td>Market cap</td><td>${humanQuantity(details.market_cap)}</td></tr>
			</table>
		</div>
	);
}
