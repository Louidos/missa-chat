import '@fontsource-variable/nunito';
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { applyCachedTheme } from './lib/prefs.svelte';

// Theme vor dem ersten Zeichnen setzen (kein Aufblitzen im falschen Modus).
applyCachedTheme();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
