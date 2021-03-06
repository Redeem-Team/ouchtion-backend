import httpStatus from 'http-status-codes';
import {
	BAD_DELETE,
	INVALID_AUCTION_END_DATE,
	IS_EXIST,
	NOT_FOUND_FILE,
	NOT_FOUND_IMAGE,
	NOT_FOUND_PRODUCT,
	NOT_FOUND_USER,
	NOT_PERMISSION,
	PRODUCT_NOT_END,
	UNEXPECTED_ERROR,
} from '../helpers/constants/errors';
import { formatDate } from '../helpers/constants/ISOtoDate';
import removeFile from '../helpers/constants/removeFile';
import { ProductModel, UserModel } from '../models';
import { getIO } from '../helpers/constants/socketIO';
import { PRODUCT_ADD, PRODUCT_ADD_WATCHLIST, PRODUCT_APPEND_DESCRIPTION, PRODUCT_DELETE, PRODUCT_DELETE_WATCHLIST } from '../helpers/constants/keyConstant';

export default {
	searchProduct: async (req, res) => {
		try {
			const products = await ProductModel.search(
				req.query.query,
				req.query.sort,
				req.query.page,
				req.query.category,
				req.query.number
			);
			return res.status(httpStatus.OK).send(products);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getProduct: async (req, res) => {
		try {
			const id = req.params.id;

			// Get product
			const product = await ProductModel.getProduct(id);

			// Check if product exist
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			return res.status(httpStatus.OK).send(product);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	// TODO: May remove this
	getAllProductBySellerId: async (req, res) => {
		try {
			const user = await UserModel.findById(req.body.seller_id);
			if (user === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_USER);
			}
			const products = await ProductModel.findBySellerId(req.body.seller_id);
			return res.json(products);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	addProduct: async (req, res) => {
		try {
			const file = req.file;
			if (!file) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_FILE);
			}

			// cut path file
			const index = file.path.indexOf('\\');
			const path = file.path.substring(index + 1);

			// Check valid end_at
			const endAt = new Date(req.body.end_at);
			if (endAt.getTime() < new Date().getTime()) {
				return res.status(httpStatus.BAD_REQUEST).send(INVALID_AUCTION_END_DATE);
			}

			req.body.seller_id = req.accessTokenPayload.userId;
			req.body.avatar = path;
			req.body.end_at = formatDate(endAt);
			req.body.current_price = req.body.init_price;

			// add product
			const row = await ProductModel.add(req.body);
			const product_id = row[0];

			const product = await ProductModel.findById(product_id);

			// socket emit
			getIO().emit(PRODUCT_ADD, {
				user_id: req.body.seller_id,
			});

			return res.json(product);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	updateProduct: async (req, res) => {
		try {
			// get product with id
			// const product = await ProductModel.findById(req.params.id);
			const product = req.product;

			const file = req.file;
			if (file) {
				// cut path file
				const index = file.path.indexOf('\\');
				const path = file.path.substring(index + 1);
				if (product.avatar) {
					await removeFile(process.env.PATH_FOLDER_PUBLIC + product.avatar);
				}
				req.body.avatar = path;
			}

			// update product
			const n = await ProductModel.patch(req.params.id, req.body);
			if (n === 0) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			const productNew = await ProductModel.findById(req.params.id);

			// socket emit
			// getIO().emit('updateProduct', {
			// 	message: 'Update product',
			// 	data: productNew,
			// });

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	deleteProduct: async (req, res) => {
		try {
			// get product by id
			const product = await ProductModel.findById(req.params.id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			const inBidding = await ProductModel.isInBidding(req.params.id);
			if (inBidding === true) {
				return res.status(httpStatus.BAD_REQUEST).send(BAD_DELETE);
			}

			// remove product
			const n = await ProductModel.removeProduct(req.params.id);
			if (n === 0) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			// socket emit
			getIO().emit(PRODUCT_DELETE, {
				product_id:req.params.id,
				user_id:product.seller_id,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			if (err.errno === 1451) {
				return res.status(httpStatus.BAD_REQUEST).send(BAD_DELETE);
			}
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getProductsForAdmin: async (req, res) => {
		try {
			const products = await ProductModel.searchForAdmin(
				req.query.query,
				req.query.sort,
				req.query.page,
				req.query.category,
				req.query.number
			);
			return res.status(httpStatus.OK).send(products);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	uploadImage: async (req, res) => {
		try {
			// get product by id
			// const product = await ProductModel.findById(req.params.id);
			const product = req.product;

			// upload with multer (async function)
			const file = req.file;
			if (!file) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_FILE);
			}

			// cut path file
			const index = file.path.indexOf('\\');
			const path = file.path.substring(index + 1);

			// use try catch because this is async function
			try {
				// add image to database
				var imageId = await ProductModel.addImage(req.params.id, path);
				imageId = imageId[0];

				const image = await ProductModel.findImage(product.product_id, imageId);

				// socket emit
				// getIO().emit('newProductImage', {
				// 	message: 'New product image',
				// 	data: image,
				// });
			} catch (err) {
				console.log(err);
				return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
			}
			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getDescriptions: async (req, res) => {
		try {
			// get product by id
			const product = await ProductModel.findById(req.params.id);

			// check product exist
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}
			const descriptions = await ProductModel.getDescriptions(req.params.id);
			return res.json(descriptions);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},
	getImages: async (req, res) => {
		try {
			// Get product by id
			const product = await ProductModel.findById(req.params.id);

			// check product exist
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}
			const images = await ProductModel.getImages(req.params.id);
			return res.json(images);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	addDescription: async (req, res) => {
		try {
			// get product by id
			const product = await ProductModel.findById(req.params.id);

			// check product exist
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			// create entity
			const entity = {
				product_id: req.params.id,
				description: req.body.description,
			};

			// add description
			var descriptionId = await ProductModel.addDescription(entity);
			descriptionId = descriptionId[0];

			// socket emit
			getIO().emit(PRODUCT_APPEND_DESCRIPTION, {
				product_id:req.params.id,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	deleteDescription: async (req, res) => {
		try {
			const product_id = req.params.id;
			const description_id = req.params.descriptionId;

			// get product by id
			// const product = await ProductModel.findById(product_id);
			const product = req.product;

			const n = await ProductModel.deleteDescription(product_id, description_id);
			// not found this product
			if (n === 0) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}
			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	deleteImage: async (req, res) => {
		try {
			const product_id = req.params.id;
			const image_id = req.params.imageId;

			// get product by id
			// const product = await ProductModel.findById(product_id);
			const product = req.product;

			// get image
			const image = await ProductModel.findImage(product_id, image_id);

			// check product exist
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			// check image exist
			if (image === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_IMAGE);
			}

			await removeFile(process.env.PATH_FOLDER_PUBLIC + image.path);
			const n = await ProductModel.deleteImage(product_id, image_id);
			// not found this product
			if (n === 0) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			// socket emit
			// getIO().emit('deleteProductImage', {
			// 	message: 'Delete product image',
			// 	data: image,
			// });

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getAllBidding: async (req, res) => {
		try {
			const biddings = await ProductModel.getAllBidding(req.params.id);
			return res.json(biddings);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getBiddingProducts: async (req, res) => {
		try {
			// Get user id
			const user_id = req.accessTokenPayload.userId;

			// Get user by id
			const user = await UserModel.findById(user_id);

			// Check user exist
			if (user === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_USER);
			}

			const products = await ProductModel.getBiddingProducts(user_id);

			res.status(httpStatus.OK).send(products);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getHasWonProducts: async (req, res) => {
		try {
			// Get user id
			const user_id = req.accessTokenPayload.userId;

			// Get user by id
			const user = await UserModel.findById(user_id);

			// Check user exist
			if (user === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_USER);
			}

			const products = await ProductModel.getHasWonProducts(user_id);

			res.status(httpStatus.OK).send(products);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getWatchList: async (req, res) => {
		try {
			// Get user id from token
			const user_id = req.accessTokenPayload.userId;

			// Get user by id
			const user = await UserModel.findById(user_id);

			// Check user exist
			if (user === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_USER);
			}

			const watchlist = await UserModel.getWatchList(user_id);
			return res.send(watchlist);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	addWatch: async (req, res) => {
		try {
			// get user id from token
			const user_id = req.accessTokenPayload.userId;
			// get user by id
			const user = await UserModel.findById(user_id);

			// check product exist
			if (user === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_USER);
			}

			// check watch exist
			const isInWatchList = await UserModel.isInWatchList(user_id, req.body.product_id);
			if (isInWatchList) {
				return res.status(httpStatus.BAD_REQUEST).send(IS_EXIST);
			}
			await UserModel.addWatch(user_id, req.body.product_id);

			// socket emit
			getIO().emit(PRODUCT_ADD_WATCHLIST, {
				user_id:user_id,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	deleteWatch: async (req, res) => {
		try {
			// get user id from token
			const user_id = req.accessTokenPayload.userId;
			// get user by id
			const user = await UserModel.findById(user_id);

			// check product exist
			if (user === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_USER);
			}

			const n = await UserModel.deleteWatch(user_id, req.body.product_id);
			if (n === 0) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_WATCH);
			}

			// socket emit
			getIO().emit(PRODUCT_DELETE_WATCHLIST, {
				user_id:user_id,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	productsActive: async (req, res) => {
		try {
			const products = await ProductModel.productsActive(req.accessTokenPayload.userId);
			return res.json(products);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	productsInActive: async (req, res) => {
		try {
			const products = await ProductModel.productsInActive(req.accessTokenPayload.userId);
			return res.json(products);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getRate: async (req, res) => {
		try {
			const product = await ProductModel.findById(req.params.id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			const finishedProduct = await ProductModel.getFinishedProduct(req.params.id);

			if (finishedProduct.length !== 1) {
				return res.status(httpStatus.BAD_REQUEST).send(PRODUCT_NOT_END);
			}

			const rates = await ProductModel.getRate(req.params.id);

			return res.status(httpStatus.OK).send(rates);
		} catch (err) {
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},
};
