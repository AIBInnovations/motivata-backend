[USER-CREATION] User not found with phone 9179621765, creating new user
[USER-CREATION] Duplicate key error. Trying to find existing user by phone
[USER-CREATION] Failed to create/find user: MongoServerError: E11000 duplicate key error collection: motivata.users index: email_1 dup key: { email: null }
at InsertOneOperation.handleOk (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/operations/insert.js:51:19)
at tryOperation (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/operations/execute_operation.js:214:34)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
at async executeOperation (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/operations/execute_operation.js:78:16)
at async Collection.insertOne (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/collection.js:154:16) {
errorLabelSet: Set(0) {},
errorResponse: {
index: 0,
code: 11000,
errmsg: 'E11000 duplicate key error collection: motivata.users index: email_1 dup key: { email: null }',
keyPattern: { email: 1 },
keyValue: { email: null }
},
index: 0,
code: 11000,
keyPattern: { email: 1 },
keyValue: { email: null }
}
[ENROLLMENT] Error creating enrollment: MongoServerError: E11000 duplicate key error collection: motivata.users index: email_1 dup key: { email: null }
at InsertOneOperation.handleOk (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/operations/insert.js:51:19)
at tryOperation (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/operations/execute_operation.js:214:34)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
at async executeOperation (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/operations/execute_operation.js:78:16)
at async Collection.insertOne (/home/ubuntu/motivata-backend/node_modules/mongoose/node_modules/mongodb/lib/collection.js:154:16) {
errorLabelSet: Set(0) {},
errorResponse: {
index: 0,
code: 11000,
errmsg: 'E11000 duplicate key error collection: motivata.users index: email_1 dup key: { email: null }',
keyPattern: { email: 1 },
keyValue: { email: null }
},
index: 0,
code: 11000,
keyPattern: { email: 1 },
keyValue: { email: null }
}
✓ Payment processed. Users, enrollment, and emails sent successfully.
=== Webhook Processing Complete ===
