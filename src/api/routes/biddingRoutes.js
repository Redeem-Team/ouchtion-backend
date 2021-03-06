const router = require('express').Router();
import { BiddingController } from '../controllers';
import validate from '../middlewares/validate.js';
import {
	BiddingSchema,
	AutoBiddingSchema,
	BuyProductSchema,
	BiddingRequestPostSchema,
	BiddingPermissionSchema,
	BiddingRequestSchema,
	BiddingRequestPutSchema,
	AutoBiddingDisableSchema,
} from '../schemas';
import isBidder from '../middlewares/isBidder.js';
import isSeller from '../middlewares/isSeller.js';
import isPermittedToBid from '../middlewares/isPermittedToBid';

// Per bidder
router.post('/', isBidder, isPermittedToBid, validate(BiddingSchema), BiddingController.addBidding);
router.post('/autoBidding', isBidder, isPermittedToBid, validate(AutoBiddingSchema), BiddingController.addAutoBidding);

// TODO: what if it is banned
router.delete('/autoBidding',validate(AutoBiddingDisableSchema) , BiddingController.disableAutoBidding);

router.post('/buyProduct', isBidder, validate(BuyProductSchema), BiddingController.buyNowProduct);
router.post('/bidders/biddingRequests', isBidder, validate(BiddingRequestPostSchema), BiddingController.addBiddingRequest);
router.get('/bidders/biddingRequests/products/:id', isBidder, BiddingController.getBiddingRequest);
router.get('/bidders/biddingPermission/products/:id', isBidder, BiddingController.getPermission);

// Per seller
router.post('/rejectBidding/:id', isSeller, BiddingController.rejectBidding);
router.get('/sellers/biddingRequests/products/:id', isSeller, BiddingController.getBiddingRequests);
router.put('/sellers/biddingRequests/:id', isSeller, validate(BiddingRequestPutSchema), BiddingController.updateRequest);

router.post('/sellers/biddingPermission', isSeller, BiddingController.getBiddingPermissionProduct);
router.put('/sellers/biddingPermission', isSeller, validate(BiddingPermissionSchema), BiddingController.updatePermission);

export default router;
