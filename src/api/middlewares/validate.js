import Ajv from 'ajv';
import httpStatus from 'http-status-codes';
import { VALIDATION_ERROR } from '../helpers/constants/errors';
import addFormats from 'ajv-formats';

function parseErrors(validationErrors) {
	let errors = [];
	validationErrors.forEach((error) => {
		errors.push({
			param: error,
			key: error.keyword,
			message: error.message,
			property: (function () {
				return error.keyword === 'minimum' ? error.dataPath : undefined;
			})(),
		});
	});

	return errors;
}

export default (schema) => (req, res, next) => {
	const ajv = new Ajv({ allErrors: true });
	ajv.addFormat('string-of-int', {
		validate: (string) => !isNaN(string),
	});
	addFormats(ajv);
	const valid = ajv.validate(schema, req.body);
	if (!valid) {
		const errorParse = parseErrors(ajv.errors);
		return res.status(httpStatus.UNPROCESSABLE_ENTITY).send(VALIDATION_ERROR(errorParse));
	}
	next();
};
