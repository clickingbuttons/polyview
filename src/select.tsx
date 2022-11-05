import { IRestClient } from '@polygon.io/client-js';
import { useState, useEffect, useRef, useCallback, StateUpdater } from 'preact/hooks';
import './select.css';

export type SymbolPickerProps = {
	rest: IRestClient;
	value: any;
	onChange: (value: any, ev: any) => void;
	disabled: Boolean;
};

function debounce(func, timeout = 100){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

export function SymbolPicker({
	rest,
	value,
	onChange: userOnChange
}: SymbolPickerProps) {
	const [innerValue, setInnerValue] = useState(value);
	const [items, setItems] = useState([]);
	const [isOpen, setIsOpen] = useState(false);
	const div = useRef<HTMLDivElement>();

	function fetchItems(value: string, setItems: StateUpdater<any>) {
		rest.reference.tickers({ search: value, limit: 100 })
			.then(res => res.results)
			.then(res => setItems(res));
	}
	const debouncedFetchItems = useCallback(debounce(fetchItems, 200), []);

	useEffect(() => isOpen && debouncedFetchItems(innerValue, setItems), [innerValue, isOpen]);

	function onClick(v, ev) {
		userOnChange(v, ev);
		setInnerValue(v);
		setIsOpen(false);
	}

	function onKeyPress(ev) {
		if (ev.which === 13) {
			onClick(innerValue, ev);
		}
	}

	function onBlur(ev) {
		if (div.current && !div.current.contains(ev.relatedTarget)) {
			setIsOpen(false);
		}
	}

	return (
		<div ref={div} class="select">
			<input
				value={innerValue}
				onInput={ev => setInnerValue(ev.target.value.toUpperCase())}
				onFocus={() => setIsOpen(true)}
				onBlur={onBlur}
				onKeyPress={onKeyPress}
				/>
			{isOpen && (
				<div class="select-items">
					{items.map(item => (
						<button class="select-item" onClick={ev => onClick(item.ticker, ev)} onBlur={onBlur}>
							{item.ticker} {item.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
