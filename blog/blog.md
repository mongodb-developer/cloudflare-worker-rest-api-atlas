# Create a REST API with Cloudflare Worker, MongoDB Atlas & Realm

## Introduction

[Cloudflare Workers](https://workers.cloudflare.com/) provides a serverless execution environment that allows you to create entirely new applications or augment existing ones without configuring or maintaining infrastructure.

[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) allows you to create, manage and monitor MongoDB clusters in the cloud provider of your choice (AWS, GCP or Azure) while [MongoDB Realm](https://www.mongodb.com/realm) Application can provide a layer of authentication and define access rules to the collections.

In this blog post, we will combine all these technologies together and create a REST API with a Cloudflare worker using the [MongoDB Realm Web SDK](https://docs.mongodb.com/realm/web/) and a MongoDB Atlas cluster to store the data.

## TL;DR!

The worker is in this [GitHub repository](https://github.com/mongodb-developer/cloudflare-worker-rest-api-realm-atlas). The [README](https://github.com/mongodb-developer/cloudflare-worker-rest-api-realm-atlas/blob/main/README.md) will get you up and running in no time if you know what you are doing. Else I suggest you follow this step-by-step blog post ;-).

```shell
$ git clone git@github.com:mongodb-developer/cloudflare-worker-rest-api-realm-atlas.git
```

## Prerequisistes

- NO credit card! You can run this entire tutorial for free!
- [Git](https://git-scm.com/) and [cURL](https://en.wikipedia.org/wiki/CURL).
- [MongoDB Cloud account](https://www.mongodb.com/cloud/atlas/).
- [MongoDB Atlas Cluster (a free M0 cluster is fine)](https://docs.atlas.mongodb.com/tutorial/deploy-free-tier-cluster/).
- [Cloudflare](https://www.cloudflare.com/) account (free plan is fine) with a `*.workers.dev` subdomain for the workers. Follow the [steps 1 to 3 from this documentation](https://developers.cloudflare.com/workers/get-started/guide) to get everything you need.

We will create the Realm Application together in the next section. This will provide you the Realm AppID and API key that we need.

To deploy our Cloudflare worker, we will need:
- The [Realm Application ID](https://docs.mongodb.com/realm/get-started/find-your-project-or-app-id/) (top left corner in your Realm App - see next section).
- The Cloudflare account login/password.
- The Cloudflare account ID (in Workers tab > Overview).

To test (or interact with) the REST API we need:
- The Realm authentication API key (more about that below, but it's in Authentication tab > API Keys).
- The Cloudflare `*.workers.dev` subdomain (in Workers tab > Overview).

It was created during this step during your set up:

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/create_subdomain_445263d59f.png)

## Create and Configure the Realm Application

To begin with, head to your MongoDB Atlas main page where you can see your cluster and access the Realm tab at the top.

[Create an empty Realm Application](https://docs.mongodb.com/realm/manage-apps/create/create-with-realm-ui/) (no template) as close as possible to your MongoDB Atlas cluster to avoid latency between your cluster and Realm App. My Realm App is "local" in Ireland (eu-west-1) in my case.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/access_realm_9e0e5322de.png)

Now that our Realm App is created we need to set up 2 things: authentication via API keys and collection rules. Before that, note that you can retrieve your Realm App ID in the top left corner of your new application.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_appid_95ae074d2d.png)

### Authentication via API Keys

Head to Authentication > API Keys.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_authentication1_61b8fdc932.png)

Activate the provider and save the draft.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_authentication2_14c746b282.png)

We need to create an API key, but we can only do so if the provider is already deployed. Click on review and deploy.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_review_deploy_6deae762a2.png)

Now you can create an API key and **save it somewhere**! It will only be displayed **once**. If you lose it, discard this one and create a new one.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_api_key_81bb588716.png)

We only have a single user in our application as we only created a single API key. Note that this tutorial would work with any other authentication method if you update the authentication code accordingly in the worker.

### Collection Rules

By default, your Realm Application cannot access any collection from your MongoDB Cluster. To define how users can interact with the data, you must [define roles and permissions](https://docs.mongodb.com/realm/mongodb/define-roles-and-permissions/).

In our case, we want to create a basic REST API where each user can read and write their own data in a single collection `todos` in the `cloudflare` database.

Head to the Rules tab and let's create this new `cloudflare.todos` collection.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_rules1_7840fef067.png)

Each document will belong to a unique user defined by the `owner` field. This field will contain the user ID that you can see in the `App Users` tab.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/realm_rules2_d0647d30d9.png)

You can now click one more time on `Review Draft and Deploy`. Our Realm Application is now ready to use.

## Set Up and Deploy the Cloudflare Worker

The Cloudflare worker is available in [GitHub repository](https://github.com/mongodb-developer/cloudflare-worker-rest-api-realm-atlas). Let's clone the repository.

```shell
$ git clone git@github.com:mongodb-developer/cloudflare-worker-rest-api-realm-atlas.git
cd cloudflare-worker-rest-api-realm-atlas
```

Now that we have the worker template, we just need to change the configuration to deploy it on your Cloudflare account.

Edit the file `wrangler.toml`:
- replace `CLOUDFLARE_ACCOUNT_ID` with your real Cloudflare account ID.
- replace `MONGODB_REALM_APPID` with your real MongoDB Realm App ID.

You can now deploy your worker to your Cloudflare account using [Wrangler](https://developers.cloudflare.com/workers/cli-wrangler/install-update):

```shell
$ npm i @cloudflare/wrangler -g
$ wrangler login
$ wrangler publish
```

Head to your Cloudflare account. You should now see your new worker in the Workers tab > Overview.

![](https://mongodb-devhub-cms.s3.us-west-1.amazonaws.com/cloudflare_worker_deployed_e2f606f4c5.png)

## Check out the REST API Code

Before we test the API, please take a moment to read the [code of the REST API](https://github.com/mongodb-developer/cloudflare-worker-rest-api-realm-atlas/blob/main/src/index.ts) we just deployed which is in the `src/index.ts` file:

```typescript
import * as Realm from 'realm-web';
import * as utils from './utils';

// The Worker's environment bindings. See `wrangler.toml` file.
interface Bindings {
    // MongoDB Realm Application ID
    REALM_APPID: string;
}

// Define type alias; available via `realm-web`
type Document = globalThis.Realm.Services.MongoDB.Document;

// Declare the interface for a "todos" document
interface Todo extends Document {
    owner: string;
    done: boolean;
    todo: string;
}

let App: Realm.App;
const ObjectId = Realm.BSON.ObjectID;

// Define the Worker logic
const worker: ExportedHandler<Bindings> = {
    async fetch(req, env) {
        const url = new URL(req.url);
        App = App || new Realm.App(env.REALM_APPID);

        const method = req.method;
        const path = url.pathname.replace(/[/]$/, '');
        const todoID = url.searchParams.get('id') || '';

        if (path !== '/api/todos') {
            return utils.toError(`Unknown "${path}" URL; try "/api/todos" instead.`, 404);
        }

        const token = req.headers.get('authorization');
        if (!token) return utils.toError('Missing "authorization" header; try to add the header "authorization: REALM_API_KEY".', 401);

        try {
            const credentials = Realm.Credentials.apiKey(token);
            // Attempt to authenticate
            var user = await App.logIn(credentials);
            var client = user.mongoClient('mongodb-atlas');
        } catch (err) {
            return utils.toError('Error with authentication.', 500);
        }

        // Grab a reference to the "cloudflare.todos" collection
        const collection = client.db('cloudflare').collection<Todo>('todos');

        try {
            if (method === 'GET') {
                if (todoID) {
                    // GET /api/todos?id=XXX
                    return utils.reply(
                        await collection.findOne({
                            _id: new ObjectId(todoID)
                        })
                    );
                }

                // GET /api/todos
                return utils.reply(
                    await collection.find()
                );
            }

            // POST /api/todos
            if (method === 'POST') {
                const {todo} = await req.json();
                return utils.reply(
                    await collection.insertOne({
                        owner: user.id,
                        done: false,
                        todo: todo,
                    })
                );
            }

            // PATCH /api/todos?id=XXX&done=true
            if (method === 'PATCH') {
                return utils.reply(
                    await collection.updateOne({
                        _id: new ObjectId(todoID)
                    }, {
                        $set: {
                            done: url.searchParams.get('done') === 'true'
                        }
                    })
                );
            }

            // DELETE /api/todos?id=XXX
            if (method === 'DELETE') {
                return utils.reply(
                    await collection.deleteOne({
                        _id: new ObjectId(todoID)
                    })
                );
            }

            // unknown method
            return utils.toError('Method not allowed.', 405);
        } catch (err) {
            const msg = (err as Error).message || 'Error with query.';
            return utils.toError(msg, 500);
        }
    }
}

// Export for discoverability
export default worker;
```

## Test the REST API

Now that you are a bit more familiar with this REST API, let's test it!

Note that we decided to pass the values as parameters and the authorization API key as a header like this:

```
authorization: API_KEY_GOES_HERE
```

You can use [Postman](https://www.postman.com/) or anything you want to test your REST API, but to make it easy I made some bash script in the `api_tests` folder.

In order to make them work, we need to edit the file `api_tests/variables.sh` and provide them with:

- the Cloudflare worker URL: replace `YOUR_SUBDOMAIN` so the final worker URL matches yours.
- the MongoDB Realm App API key: replace `YOUR_REALM_AUTH_API_KEY` with your Realm auth API key.

Finally, we can execute all the scripts like this for example:

```shell
$ ./post.sh "Write a good README.md for Github"
{
  "insertedId": "618615d879c8ad6d1129977d"
}

$ ./post.sh "Commit and push"
{
  "insertedId": "618615e479c8ad6d11299e12"
}

$ ./findAll.sh 
[
  {
    "_id": "618615d879c8ad6d1129977d",
    "owner": "6186154c79c8ad6d11294f60",
    "done": false,
    "todo": "Write a good README.md for Github"
  },
  {
    "_id": "618615e479c8ad6d11299e12",
    "owner": "6186154c79c8ad6d11294f60",
    "done": false,
    "todo": "Commit and push"
  }
]

$ ./findOne.sh 618615d879c8ad6d1129977d
{
  "_id": "618615d879c8ad6d1129977d",
  "owner": "6186154c79c8ad6d11294f60",
  "done": false,
  "todo": "Write a good README.md for Github"
}

$ ./patch.sh 618615d879c8ad6d1129977d true
{
  "matchedCount": 1,
  "modifiedCount": 1
}

$ ./findAll.sh 
[
  {
    "_id": "618615d879c8ad6d1129977d",
    "owner": "6186154c79c8ad6d11294f60",
    "done": true,
    "todo": "Write a good README.md for Github"
  },
  {
    "_id": "618615e479c8ad6d11299e12",
    "owner": "6186154c79c8ad6d11294f60",
    "done": false,
    "todo": "Commit and push"
  }
]

$ ./deleteOne.sh 618615d879c8ad6d1129977d
{
  "deletedCount": 1
}

$ ./findAll.sh 
[
  {
    "_id": "618615e479c8ad6d11299e12",
    "owner": "6186154c79c8ad6d11294f60",
    "done": false,
    "todo": "Commit and push"
  }
]
```

As you can see, the REST API works like a charm!

## Wrap Up

Cloudflare offers a Workers [KV](https://developers.cloudflare.com/workers/runtime-apis/kv) product that _can_ make for a quick combination with Workers, but it's still a simple key-value datastore and most applications will outgrow it. By contrast, MongoDB is a powerful, full-featured database that unlocks the ability to store, query, and index your data without compromising the security or scalability of your application.

As demonstrated in this blog post, it is possible to take full advantage of both technologies. As a result, we built a powerful and secure serverless REST API that will scale very well.

If you have questions, please head to our [developer community website](https://www.mongodb.com/community/forums/) where the MongoDB engineers and the MongoDB community will help you build your next big idea with MongoDB. If your question is related to Cloudflare, I encourage you to join their [active Discord community](https://workers.community).
