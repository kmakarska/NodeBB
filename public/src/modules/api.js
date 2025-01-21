/* eslint-disable import/no-unresolved */

'use strict';

import { fire as fireHook } from 'hooks';
import { confirm } from 'bootbox';

const baseUrl = config.relative_path + '/api/v3';

async function call(options, callback) {
	options.url = options.url.startsWith('/api') ?
		config.relative_path + options.url :
		baseUrl + options.url;

	if (typeof callback === 'function') {
		xhr(options).then(result => callback(null, result), err => callback(err));
		return;
	}

	try {
		const result = await xhr(options);
		return result;
	} catch (err) {
		if (err.message === 'A valid login session was not found. Please log in and try again.') {
			const { url } = await fireHook('filter:admin.reauth', { url: 'login' });
			return confirm('[[error:api.reauth-required]]', (ok) => {
				if (ok) {
					ajaxify.go(url);
				}
			});
		}
		throw err;
	}
}

// general logic for function xhr and helpers derived from ChatGPT
// Perform the actual HTTP request using fetch()
async function xhr(options) {
	const { url, headers, body } = await prepareRequest(options);
	const response = await fetchResponse(url, options.method, headers, body);
	return parseResponse(response);
}

// Prepare the request object by normalizing and adding headers
async function prepareRequest(options) {
	const { url } = options;
	delete options.url;

	// If data is not a FormData instance, serialize it to JSON
	if (options.data && !(options.data instanceof FormData)) {
		options.data = JSON.stringify(options.data || {});
		options.headers['content-type'] = 'application/json; charset=utf-8';
	}
	// Allow plugins to modify options via hook
	({ options } = await fireHook('filter:api.options', { options }));

	// For backwards compatibility, map "data" to "body"
	if (options.data) {
		options.body = options.data;
		delete options.data;
	}

	return {
		url,
		headers: options.headers,
		body: options.body,
	};
}
// Send the HTTP request and validate the response
async function fetchResponse(url, method, headers, body) {
	const res = await fetch(url, { method, headers, body });

	// If the response is not OK, parse and throw an error
	if (!res.ok) {
		const error = await parseErrorResponse(res);
		throw new Error(error);
	}
	return res;
}

// Parse errors from the response
async function parseErrorResponse(res) {
	const contentType = res.headers.get('content-type');
	const isJSON = contentType && contentType.startsWith('application/json');

	// Parse JSON or return plain text error message
	if (isJSON) {
		const response = await res.json();
		return response.status?.message || res.statusText;
	}
	return res.statusText;
}

// Parse the response based on content type
async function parseResponse(res) {
	const contentType = res.headers.get('content-type');
	const isJSON = contentType && contentType.startsWith('application/json');

	if (res.method !== 'HEAD') {
		// Parse JSON or plain text response
		const response = isJSON ? await res.json() : await res.text();
		if (isJSON && response?.status && response?.response) {
			return response.response;
		}
		return response;
	}

	return null;// HEAD requests have no response body
}

export function get(route, data, onSuccess) {
	return call({
		url: route + (data && Object.keys(data).length ? ('?' + $.param(data)) : ''),
	}, onSuccess);
}

export function head(route, data, onSuccess) {
	return call({
		url: route + (data && Object.keys(data).length ? ('?' + $.param(data)) : ''),
		method: 'HEAD',
	}, onSuccess);
}

export function post(route, data, onSuccess) {
	return call({
		url: route,
		method: 'POST',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function patch(route, data, onSuccess) {
	return call({
		url: route,
		method: 'PATCH',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function put(route, data, onSuccess) {
	return call({
		url: route,
		method: 'PUT',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function del(route, data, onSuccess) {
	return call({
		url: route,
		method: 'DELETE',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}
