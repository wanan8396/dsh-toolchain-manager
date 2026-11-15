// Entry shim: the implementation lives in host.js. The query keeps a re-import
// of this entry from reusing a stale module generation inside one process.
export * from './host.js?rev=6'
