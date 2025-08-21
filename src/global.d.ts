declare module '*.svelte' {
	interface ComponentConstructorOptions<Props = Record<string, unknown>> {
		target: Element | DocumentFragment;
		anchor?: Element;
		props?: Props;
		context?: Map<unknown, unknown>;
		hydrate?: boolean;
		intro?: boolean;
		$$inline?: boolean;
	}
	interface SvelteComponentDev {
		$set(props?: Record<string, unknown>): void;
		$on(event: string, callback: (event: unknown) => void): () => void;
		$destroy(): void;
		[accessor: string]: unknown;
	}
	const component: {
		new (options: ComponentConstructorOptions): SvelteComponentDev;
	};
	export default component;
}