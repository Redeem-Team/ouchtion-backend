const schema = {
	type: 'object',
	properties: {
		password: { type: 'string' },
		token: { type: 'string' },
	},
	required: ['password', 'token'],
	additionalProperties: false,
};

export default schema;
