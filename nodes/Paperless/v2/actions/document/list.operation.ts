import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, apiRequestPaginated } from '../../transport';

// Accepts a comma-separated string ("3,5"), a single id, or an array of ids,
// and returns a comma-separated id string for the Paperless query, or undefined.
function toIdList(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const parts = Array.isArray(value) ? value : String(value).split(',');
	const ids = parts.map((p) => Number(String(p).trim())).filter((n) => !Number.isNaN(n));
	return ids.length ? ids.join(',') : undefined;
}

export const description: INodeProperties[] = [
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		default: {},
		hint: 'Narrow down the documents to return. All filters are combined (AND).',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: ['list'],
			},
		},
		placeholder: 'Add Filter',
		options: [
			{
				displayName: 'Correspondent ID',
				name: 'correspondent__id',
				default: '',
				description: 'Only documents with this correspondent (numeric ID)',
				type: 'number',
			},
			{
				displayName: 'Created After',
				name: 'created__date__gte',
				default: '',
				description: 'Only documents created on or after this date',
				type: 'dateTime',
			},
			{
				displayName: 'Created Before',
				name: 'created__date__lte',
				default: '',
				description: 'Only documents created on or before this date',
				type: 'dateTime',
			},
			{
				displayName: 'Document Type ID',
				name: 'document_type__id',
				default: '',
				description: 'Only documents of this document type (numeric ID)',
				type: 'number',
			},
			{
				displayName: 'Has All Tags',
				name: 'tags__id__all',
				default: '',
				description:
					'Comma-separated tag IDs (e.g. "3,5"). Only documents that have all of these tags.',
				placeholder: '3,5',
				type: 'string',
			},
			{
				displayName: 'Has None of Tags',
				name: 'tags__id__none',
				default: '',
				description:
					'Comma-separated tag IDs (e.g. "3,5"). Exclude documents that have any of these tags.',
				placeholder: '3,5',
				type: 'string',
			},
			{
				displayName: 'Limit',
				name: 'page_size',
				default: 25,
				description: 'Max number of results to return',
				type: 'number',
				typeOptions: { minValue: 1 },
			},
			{
				displayName: 'Ordering',
				name: 'ordering',
				default: '-created',
				description: 'How to sort the results',
				type: 'options',
				options: [
					{ name: 'Added (Newest First)', value: '-added' },
					{ name: 'Added (Oldest First)', value: 'added' },
					{ name: 'Created (Newest First)', value: '-created' },
					{ name: 'Created (Oldest First)', value: 'created' },
					{ name: 'Title (A-Z)', value: 'title' },
					{ name: 'Title (Z-A)', value: '-title' },
				],
			},
			{
				displayName: 'Search Query',
				name: 'query',
				default: '',
				description: 'Full-text search across document content and metadata',
				type: 'string',
			},
			{
				displayName: 'Similar to Document ID',
				name: 'more_like_id',
				default: '',
				description: 'Return documents similar to the document with this ID',
				type: 'number',
			},
			{
				displayName: 'Storage Path ID',
				name: 'storage_path__id',
				default: '',
				description: 'Only documents with this storage path (numeric ID)',
				type: 'number',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const endpoint = '/documents/';
	const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	const qs: IDataObject = {};

	if (filters.query) qs.query = filters.query;
	if (filters.ordering) qs.ordering = filters.ordering;
	if (filters.more_like_id) qs.more_like_id = filters.more_like_id;
	if (filters.correspondent__id) qs.correspondent__id = filters.correspondent__id;
	if (filters.document_type__id) qs.document_type__id = filters.document_type__id;
	if (filters.storage_path__id) qs.storage_path__id = filters.storage_path__id;

	const tagsAll = toIdList(filters.tags__id__all);
	if (tagsAll) qs.tags__id__all = tagsAll;
	const tagsNone = toIdList(filters.tags__id__none);
	if (tagsNone) qs.tags__id__none = tagsNone;

	if (filters.created__date__gte)
		qs.created__date__gte = String(filters.created__date__gte).slice(0, 10);
	if (filters.created__date__lte)
		qs.created__date__lte = String(filters.created__date__lte).slice(0, 10);

	// NOTE: When a limit is set, request a single page of that size instead of paginating
	// through every result, so the agent can ask for "the first N documents" efficiently.
	if (filters.page_size) {
		qs.page_size = filters.page_size;
		const response = (await apiRequest.call(
			this,
			itemIndex,
			'GET',
			endpoint,
			undefined,
			qs,
		)) as { results: IDataObject[] };
		return { json: { results: response.results } };
	}

	const responses = (await apiRequestPaginated.call(
		this,
		itemIndex,
		'GET',
		endpoint,
		undefined,
		qs,
	)) as any[];

	const statusCode =
		responses.reduce((acc, response) => acc + response.statusCode, 0) / responses.length;
	if (statusCode !== 200) {
		throw new NodeOperationError(
			this.getNode(),
			`The documents you are requesting could not be found`,
			{
				description: JSON.stringify(
					responses.map((response) => response?.body?.details ?? response?.statusMessage),
				),
			},
		);
	}
	return {
		json: { results: responses.map((response) => response.body.results).flat() },
	};
}
