import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import { apiRequest, apiRequestPaginated } from '../../transport';

const tagResourceLocator: INodeProperties = {
	displayName: 'Tag',
	name: 'tag',
	default: { mode: 'list', value: '' },
	description: 'The tag ID',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			placeholder: 'Select a Tag...',
			type: 'list',
			typeOptions: {
				searchListMethod: 'tagSearch',
				searchFilterRequired: false,
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			placeholder: 'Enter Tag ID...',
			type: 'string',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[1-9][0-9]*$',
						errorMessage: 'The ID must be a positive integer',
					},
				},
			],
		},
	],
	type: 'resourceLocator',
};

function singleResourceLocator(
	name: string,
	displayName: string,
	searchMethod: string,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		default: { mode: 'list', value: '' },
		description,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				placeholder: `Select a ${displayName}...`,
				type: 'list',
				typeOptions: {
					searchListMethod: searchMethod,
					searchFilterRequired: false,
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				placeholder: `Enter ${displayName} ID...`,
				type: 'string',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[1-9][0-9]*$',
							errorMessage: 'The ID must be a positive integer',
						},
					},
				],
			},
		],
		type: 'resourceLocator',
	};
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
			singleResourceLocator(
				'correspondent__id',
				'Correspondent',
				'correspondentSearch',
				'Only documents with this correspondent',
			),
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
			singleResourceLocator(
				'document_type__id',
				'Document Type',
				'documentTypeSearch',
				'Only documents of this type',
			),
			{
				displayName: 'Has All Tags',
				name: 'tags__id__all',
				default: {},
				description: 'Only documents that have all of these tags',
				options: [
					{
						displayName: 'Tag',
						name: 'values',
						values: [tagResourceLocator],
					},
				],
				placeholder: 'Add Tag',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
			},
			{
				displayName: 'Has None of Tags',
				name: 'tags__id__none',
				default: {},
				description: 'Exclude documents that have any of these tags',
				options: [
					{
						displayName: 'Tag',
						name: 'values',
						values: [tagResourceLocator],
					},
				],
				placeholder: 'Add Tag',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
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
			singleResourceLocator(
				'storage_path__id',
				'Storage Path',
				'storagePathSearch',
				'Only documents with this storage path',
			),
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

	const correspondent = (filters.correspondent__id as IDataObject)?.value;
	if (correspondent) qs.correspondent__id = correspondent;
	const documentType = (filters.document_type__id as IDataObject)?.value;
	if (documentType) qs.document_type__id = documentType;
	const storagePath = (filters.storage_path__id as IDataObject)?.value;
	if (storagePath) qs.storage_path__id = storagePath;

	const tagsAll = ((filters.tags__id__all as IDataObject)?.values as IDataObject[])
		?.map((t) => Number((t.tag as IDataObject).value))
		.filter((id) => !Number.isNaN(id));
	if (tagsAll?.length) qs.tags__id__all = tagsAll.join(',');
	const tagsNone = ((filters.tags__id__none as IDataObject)?.values as IDataObject[])
		?.map((t) => Number((t.tag as IDataObject).value))
		.filter((id) => !Number.isNaN(id));
	if (tagsNone?.length) qs.tags__id__none = tagsNone.join(',');

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
