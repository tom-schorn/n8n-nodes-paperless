import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeParameterResourceLocator,
	INodeProperties,
	NodeOperationError,
} from 'n8n-workflow';
import { apiRequest } from '../../transport';
import { parseIds } from '../../helpers';

export const description: INodeProperties[] = [
	{
		displayName: 'ID',
		name: 'id',
		default: { mode: 'list', value: '' },
		description: 'ID of the document',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: ['update'],
			},
		},
		hint: 'The ID of the document',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				placeholder: `Select a Document...`,
				type: 'list',
				typeOptions: {
					searchListMethod: 'documentSearch',
					searchFilterRequired: false,
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				placeholder: `Enter Document ID...`,
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
			{
				displayName: 'By URL',
				name: 'url',
				placeholder: `Enter Document URL...`,
				type: 'string',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^(?:http|https)://(?:.+?)/documents/(\\d+)/details$',
							errorMessage:
								'The URL must be a valid Paperless document URL (e.g. https://paperless.example.com/documents/123/details)',
						},
					},
				],
				extractValue: {
					type: 'regex',
					regex: '^(?:http|https)://(?:.+?)/documents/(\\d+)/details$',
				},
			},
		],
		placeholder: 'ID of the document',
		required: true,
		type: 'resourceLocator',
	},
	{
		displayName: 'Update Fields',
		name: 'update_fields',
		type: 'collection',
		default: {},
		hint: 'All additional fields are automatically added to the document by Paperless if they are not set',
		displayOptions: {
			show: {
				resource: ['document'],
				operation: ['update'],
			},
		},
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Add Tags',
				name: 'add_tags',
				default: '',
				description:
					'Comma-separated tag IDs (e.g. "3,5") to add to the document\'s existing tags',
				placeholder: '3,5',
				type: 'string',
			},
			{
				displayName: 'Archive Serial Number',
				name: 'archive_serial_number',
				default: '',
				description: 'The archive serial number of the document',
				type: 'number',
			},
			{
				displayName: 'Correspondent',
				name: 'correspondent',
				default: { mode: 'list', value: '' },
				description: 'The correspondent ID of the document',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						placeholder: `Select a Correspondent...`,
						type: 'list',
						typeOptions: {
							searchListMethod: 'correspondentSearch',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						placeholder: `Enter Correspondent ID...`,
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
			},
			{
				displayName: 'Created',
				name: 'created',
				default: '',
				description: 'The date and time the document was created',
				type: 'dateTime',
			},
			{
				displayName: 'Custom Fields (JSON)',
				name: 'custom_fields',
				default: '',
				description:
					'Custom fields as a JSON array of objects, each with a field (the custom field ID) and a value. Example: [{"field":1,"value":"2026-01-01"}].',
				placeholder: '[{"field":1,"value":"…"}]',
				type: 'json',
			},
			{
				displayName: 'Document Type',
				name: 'document_type',
				default: { mode: 'list', value: '' },
				description: 'The document type ID of the document',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						placeholder: `Select a Document Type...`,
						type: 'list',
						typeOptions: {
							searchListMethod: 'documentTypeSearch',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						placeholder: `Enter Document Type ID...`,
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
			},
			{
				displayName: 'Remove Tags',
				name: 'remove_tags',
				default: '',
				description:
					'Comma-separated tag IDs (e.g. "3,5") to remove from the document\'s existing tags',
				placeholder: '3,5',
				type: 'string',
			},
			{
				displayName: 'Set Tags (Replace)',
				name: 'tags',
				default: '',
				description:
					'Comma-separated tag IDs (e.g. "3,5") that replace the document\'s entire tag set',
				placeholder: '3,5',
				type: 'string',
			},
			{
				displayName: 'Storage Path',
				name: 'storage_path',
				default: { mode: 'list', value: '' },
				description: 'The storage path ID of the document',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						placeholder: `Select a Storage Path...`,
						type: 'list',
						typeOptions: {
							searchListMethod: 'storagePathSearch',
							searchFilterRequired: false,
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						placeholder: `Enter Storage Path ID...`,
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
			},
			{
				displayName: 'Title',
				name: 'title',
				default: '',
				description: 'The title of the document',
				type: 'string',
			},
		],
	},
];

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const id = (this.getNodeParameter('id', itemIndex) as INodeParameterResourceLocator).value;
	const endpoint = `/documents/${id}/`;

	const updateFields = this.getNodeParameter('update_fields', itemIndex, {}) as any;

	// Tags: "Set" replaces the whole set; "Add"/"Remove" modify the current set.
	const setTags = parseIds(updateFields.tags);
	const addTags = parseIds(updateFields.add_tags);
	const removeTags = parseIds(updateFields.remove_tags);
	const hasSet = setTags.length > 0;
	const hasAdd = addTags.length > 0;
	const hasRemove = removeTags.length > 0;

	let tags: number[] | undefined;
	if (hasSet || hasAdd || hasRemove) {
		let base: number[];
		if (hasSet) {
			base = setTags;
		} else {
			// Add/Remove operate on the document's current tags
			const currentDocument = (await apiRequest.call(this, itemIndex, 'GET', endpoint)) as any;
			base = (currentDocument.tags || []).map((t: any) => Number(t));
		}
		if (hasAdd) base = [...new Set([...base, ...addTags])];
		if (hasRemove) {
			const remove = new Set(removeTags);
			base = base.filter((t) => !remove.has(t));
		}
		tags = base;
	}

	let customFields: any;
	if (updateFields.custom_fields !== undefined && updateFields.custom_fields !== '') {
		try {
			customFields =
				typeof updateFields.custom_fields === 'string'
					? JSON.parse(updateFields.custom_fields)
					: updateFields.custom_fields;
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				'Custom Fields must be valid JSON, e.g. [{"field":1,"value":"…"}]',
				{ itemIndex },
			);
		}
	}

	const body = {
		archive_serial_number: updateFields.archive_serial_number,
		correspondent: updateFields.correspondent?.value,
		created: updateFields.created,
		custom_fields: customFields,
		document_type: updateFields.document_type?.value,
		storage_path: updateFields.storage_path?.value,
		tags,
		title: updateFields.title,
	};

	const response = (await apiRequest.call(this, itemIndex, 'PATCH', endpoint, body)) as any;

	return { json: { results: [response] } };
}
