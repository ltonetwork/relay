// modules
import * as express from 'express';
import * as compression from 'compression';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as logger from 'morgan';
import * as errorHandler from 'errorhandler';
import * as expressValidator from 'express-validator';

// controllers
import { defaultController } from '../controllers/default';

// middleware

// express
const app = express();
app.use(compression());
app.use(cors());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());

// routes
app.get('/api', defaultController.info);

// error handler
app.use(errorHandler());

export { app };
