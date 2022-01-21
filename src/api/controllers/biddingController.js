import httpStatus from 'http-status-codes';
import dotenv from 'dotenv';
import { BiddingModel, ProductModel } from '../models';
import {
	BAD_BIDDING,
	FORBIDDEN_BIDDING,
	IS_EXIST,
	NOT_FOUND_BIDDING,
	NOT_FOUND_PRODUCT,
	NOT_PERMISSION,
	PROCESSING_REQUEST,
	UNEXPECTED_ERROR,
} from '../helpers/constants/errors';
dotenv.config();
import { getIO } from '../helpers/constants/socketIO';

export default {
	addAutoBidding: async (req, res) => {
		try {
			// check product exist
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			req.body.user_id = req.accessTokenPayload.userId;
			req.body.bid_price = product.init_price;
			req.body.is_auto_process = 1;

			if (req.body.max_price && req.body.max_price <= product.current_price) {
				return res.status(httpStatus.BAD_REQUEST).send(BAD_BIDDING);
			}

			await BiddingModel.add(req.body);
			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	disableAutoBidding: async (req, res) => {
		try {
			// get user id from token
			const user_id = req.accessTokenPayload.userId;
			await BiddingModel.disableAutoBiddingByUserIdBiddingId(user_id, req.params.id);
			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	addBidding: async (req, res) => {
		try {
			req.body.user_id = req.accessTokenPayload.userId;

			// check product exist
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			if (body.bid_price < product.step_price + product.current_price) {
				return res.status(httpStatus.BAD_REQUEST).send(BAD_BIDDING);
			}

			await BiddingModel.addBidding(req.body);

			const bidding = await BiddingModel.findById(check);
			const users = await BiddingModel.findAllUserId(product.product_id);

			// socket emit
			// getIO().emit('addBidding', {
			// 	message: 'new bidding add',
			// 	data: {
			// 		bidding: bidding,
			// 		users: users,
			// 	},
			// });

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	buyNowProduct: async (req, res) => {
		try {
			req.body.user_id = req.accessTokenPayload.userId;

			// check product exist
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			const check = await BiddingModel.buyNowProduct(req.body);
			if (check === false) {
				return res.status(httpStatus.BAD_REQUEST).send(BAD_BIDDING);
			}
			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	addBiddingRequest: async (req, res) => {
		try {
			req.body.user_id = req.accessTokenPayload.userId;

			// check product exist
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			const list = await BiddingModel.isHaveBiddingRequest(req.body);
			if (list.length === 1) {
				return res.status(httpStatus.BAD_REQUEST).send(REQUEST_SENT);
			}

			await BiddingModel.addBiddingRequest(req.body);

			// socket emit
			getIO().emit('addBiddingRequest', {
				message: 'new bidding request',
				data: req.body,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getBiddingRequests: async (req, res) => {
		try {
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			if (req.accessTokenPayload.userId !== product.seller_id) {
				return res.status(httpStatus.UNAUTHORIZED).send(NOT_PERMISSION);
			}

			const biddingRequests = await BiddingModel.getBiddingRequests(req.body.product_id);
			return res.json(biddingRequests);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	updatePermission: async (req, res) => {
		try {
			// get product with id and check the seller
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}
			if (req.accessTokenPayload.userId !== product.seller_id) {
				return res.status(httpStatus.UNAUTHORIZED).send(NOT_PERMISSION);
			}

			await BiddingModel.permissionBidding(req.body);

			// socket emit
			getIO().emit('addBiddingPermission', {
				message: 'new bidding permission',
				data: req.body,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getBiddingPermissionProduct: async (req, res) => {
		try {
			// get product with id and check the seller
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			const biddingPermissions = await BiddingModel.getBiddingPermissionProduct(req.body.product_id);
			return res.json(biddingPermissions);
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	notAllowBidding: async (req, res) => {
		try {
			// check role only bidder
			if (req.accessTokenPayload.role !== 'seller') {
				return res.status(httpStatus.UNAUTHORIZED).send(NOT_PERMISSION);
			}

			// get product with id and check the seller
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}
			if (req.accessTokenPayload.userId !== product.seller_id) {
				return res.status(httpStatus.UNAUTHORIZED).send(NOT_PERMISSION);
			}

			await BiddingModel.notAllowBidding(req.body);

			// socket emit
			getIO().emit('rejectBiddingRequest', {
				message: 'reject bidding request',
				data: req.body,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	rejectBidding: async (req, res) => {
		try {
			const bidding = await BiddingModel.findById(req.params.id);
			if (bidding === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_BIDDING);
			}

			// get product with id and check the seller
			const product = await ProductModel.findById(bidding.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}
			if (req.accessTokenPayload.userId !== product.seller_id) {
				return res.status(httpStatus.UNAUTHORIZED).send(NOT_PERMISSION);
			}

			// if product end check = false
			const check = await BiddingModel.rejectBidding(bidding.bidding_id);
			if (check === false) {
				return res.status(httpStatus.BAD_REQUEST).send(NOT_PERMISSION);
			}

			// socket emit
			getIO().emit('rejectBidding', {
				message: 'reject bidding this product',
				data: bidding,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	getPermission: async (req, res) => {
		try {
			// get product with id
			const product = await ProductModel.findById(req.body.product_id);
			if (product === null) {
				return res.status(httpStatus.NOT_FOUND).send(NOT_FOUND_PRODUCT);
			}

			let userId = req.accessTokenPayload.userId;

			const body = {
				user_id: userId,
				product_id: req.body.product_id,
			};

			let check = await BiddingModel.isBiddingPermission(body);
			if (!check) {
				return res.status(httpStatus.BAD_REQUEST).send(FORBIDDEN_BIDDING);
			}

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},

	updateRequest: async (req, res) => {
		try {
			await BiddingModel.patch(req.params.id, req.body);

			// socket emit
			getIO().emit('rejectBiddingRequest', {
				message: 'reject bidding request',
				data: req.body,
			});

			return res.status(httpStatus.NO_CONTENT).send();
		} catch (err) {
			console.log(err);
			return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
		}
	},
};
