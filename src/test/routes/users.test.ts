import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../../index';
import { getApiKey } from '../../../secrets';
import {
  getCollectionUsersMock,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockUserTelegramID2,
  mockUserTelegramID3,
} from '../utils';
import chaiExclude from 'chai-exclude';

chai.use(chaiHttp);
chai.use(chaiExclude);

describe('Users route', async function () {
  let collectionUsersMock;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();

    await collectionUsersMock.insertMany([
      { userTelegramID: mockUserTelegramID },
      {
        userTelegramID: mockUserTelegramID1,
        attributes: ['walking_dead', 'active'],
      },
      {
        userTelegramID: mockUserTelegramID2,
      },
      {
        userTelegramID: mockUserTelegramID3,
        attributes: [{ mvu_score: '34' }],
      },
    ]);
  });

  describe('POST some attributes', async function () {
    it('Should return an error if the request body is not an object', async function () {
      const res = await chai
        .request(app)
        .post('/v1/users/attributes')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        msg: 'Request body should contain an array of attribute objects.',
      });
    });

    it('Should return an error if each array element is not correct', async function () {
      const res = await chai
        .request(app)
        .post('/v1/users/attributes')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send([
          {
            userTelegramID: mockUserTelegramID,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID2,
          },
        ]);

      expect(res.body).to.deep.equal({
        msg: 'Each item in the array should have "userTelegramID" as string, "attributes" as an array.',
      });
    });

    it('Should push new attributes is no attribute exist', async function () {
      const res = await chai
        .request(app)
        .post('/v1/users/attributes')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send([
          {
            userTelegramID: mockUserTelegramID,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID2,
            attributes: [
              'walking_dead',
              'active',
              { mvu_score: '233' },
              { virtual_balance: '2' },
            ],
          },
        ]);

      expect(await collectionUsersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID1,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID2,
            attributes: [
              'walking_dead',
              'active',
              { mvu_score: '233' },
              { virtual_balance: '2' },
            ],
          },
          {
            userTelegramID: mockUserTelegramID3,
            attributes: [{ mvu_score: '34' }],
          },
        ]);

      expect(res.body).to.deep.equal({
        msg: 'Updates successful',
        result: {
          insertedCount: 0,
          matchedCount: 2,
          modifiedCount: 2,
          deletedCount: 0,
          upsertedCount: 0,
          upsertedIds: {},
          insertedIds: {},
        },
      });
    });

    it('Should update attributes if already existing', async function () {
      const res = await chai
        .request(app)
        .post('/v1/users/attributes')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send([
          {
            userTelegramID: mockUserTelegramID,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID2,
            attributes: [
              'walking_dead',
              'active',
              { mvu_score: '233' },
              { virtual_balance: '2' },
            ],
          },
          {
            userTelegramID: mockUserTelegramID3,
            attributes: [{ mvu_score: '44' }],
          },
        ]);

      expect(await collectionUsersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID1,
            attributes: ['walking_dead', 'active'],
          },
          {
            userTelegramID: mockUserTelegramID2,
            attributes: [
              'walking_dead',
              'active',
              { mvu_score: '233' },
              { virtual_balance: '2' },
            ],
          },
          {
            userTelegramID: mockUserTelegramID3,
            attributes: [{ mvu_score: '44' }],
          },
        ]);

      expect(res.body).to.deep.equal({
        msg: 'Updates successful',
        result: {
          insertedCount: 0,
          matchedCount: 3,
          modifiedCount: 3,
          deletedCount: 0,
          upsertedCount: 0,
          upsertedIds: {},
          insertedIds: {},
        },
      });
    });
  });
});
