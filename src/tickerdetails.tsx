import { IRestClient, ITickerDetails } from '@polygon.io/client-js';
import { useEffect, useState } from 'preact/hooks';
import './tickerdetails.css';
import { humanQuantity } from './helpers';

type TickerDetailsProps = {
	rest: IRestClient,
	ticker: string
};

export function TickerDetails({ rest, ticker }: TickerDetailsProps) {
	const [details, setDetails] = useState({} as ITickerDetails['results']);

	useEffect(() => {
		rest.reference.tickerDetails(ticker)
			.then(res => setDetails(res.results))
			.catch(_ => setDetails({}));
	}, [ticker]);

	return (
		<div id="tickerdetails">
			<h2>{ticker}</h2>
			<table>
				<tr>
					<td>Name</td>
					<td>
						{details.homepage_url
							? <a href={details.homepage_url}>{details.name}</a>
							: details.name
						}
					</td>
				</tr>
				{details.market === 'stocks' && <>
					<tr><td>Type</td><td>{details.type}</td></tr>
					<tr><td>Listing exchange</td><td>{details.primary_exchange}</td></tr>
					<tr><td>List date</td><td>{details.list_date || ''}</td></tr>
					<tr><td>FIGI</td><td>{details.share_class_figi || ''}</td></tr>
					<tr><td>CIK</td><td>{details.cik || ''}</td></tr>
					<tr><td>Share class shares</td><td>{humanQuantity(details.share_class_shares_outstanding)}</td></tr>
					<tr><td>Weighted shares</td><td>{humanQuantity(details.weighted_shares_outstanding)}</td></tr>
					<tr><td>Market cap</td><td>${humanQuantity(details.market_cap)}</td></tr>
					{(details as any).ticker_root != ticker &&
						<tr><td>Root ticker</td><td>{(details as any).ticker_root}</td></tr>}
				</>}
	</table>
		</div>
	);
}
