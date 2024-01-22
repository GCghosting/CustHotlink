const { Telegraf, Markup } = require('telegraf');
const { message } = require('telegraf/filters')
const axios = require('axios');
const mysql = require('mysql2');
const { format } = require('date-fns');

const botToken = '6873180957:AAHIbHnreLbtkxLr_c8HQDZHOwQUAno7PLQ';

const connection = mysql.createConnection({
    host: '167.172.81.217', //167.172.81.217
    user: 'phpmyadmin', //phpmyadmin
    password: 'kopisanperak',
    database: 'cust_hotlink',
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database.');
});

const apiService = axios.create({
    baseURL: 'https://api-digital.maxis.com.my/prod/api/',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://id2.maxis.com.my',
        'X-Api-Key': '16776d4b-4e02-4cdc-a88d-fa312ec05fa9',
        'X-Apigw-Api-id': 'a8pdjulkwe',
        'Channel': 'cui',
    }
});

const apiService2 = axios.create({
    baseURL: 'https://api-digital.maxis.com.my:4463/prod/api/',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Clientapikey': 'h0tl1nk@pp!',
        'x-api-key': '08bdedcf-6757-4c96-8efa-dbea297b0946',
        'x-apigw-api-id': 'a8pdjulkwe',
        'Channel': 'hra'
    }
});

const appHotlink = axios.create({
    baseURL: 'https://app.hotlink.com.my:4443/api/',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Clientapikey': 'h0tl1nk@pp!',
    }
});

const bot = new Telegraf(botToken);

const superAdmin = ['2129865779', '6533443621'];

bot.use((ctx, next) => {
    ctx.session = ctx.session || {};
    return next();
});

// let tempMessageId;
// let userCredit = 0;
let tokenDataSaved;
// let firstVoucherId;

async function handleStart(ctx) {
    const userId = ctx.from.id;
    bot.start(async (ctx));
}

bot.start(async (ctx) => {
    const userId = ctx.from.id;

    const checkUserQuery = 'SELECT * FROM users WHERE telegram_user_id = ?';
    connection.query(checkUserQuery, [userId], (err, results) => {
        if (err) {
            console.error('Error checking user info:', err);
            ctx.reply('Failed to check user info.');
            return;
        }

        if (results.length === 0) {
            ctx.reply('You are not authorized to use this bot. Please contact @gassturn to use it.');
            return;
        }

        fetchDataFromDB(ctx);

        ctx.replyWithMarkdown(
            `User Id: *${userId}*\nLogin to continue`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Login Number', callback_data: 'login' },
                        ],
                    ]
                }
            }
        );

    });;
});

// const save = 'INSERT IGNORE INTO users (telegram_user_id) VALUES (?)';
//     connection.query(save, [userId], (err, results) => {
//         if (err) {
//             console.error('Error saving user info:', err);
//             ctx.reply('Failed to save user info.');
//         }
//     });;

bot.command('authorize', async (ctx) => {
    const userIdToAuthorize = ctx.message.text.split(' ')[1];

    if (!superAdmin.includes(ctx.from.id.toString())) {
        ctx.reply('You are not authorized to use this command.');
        return;
    }

    if (!userIdToAuthorize) {
        ctx.reply('Please provide a user ID to authorize.');
        return;
    }

    const authorizeQuery = 'INSERT INTO users (telegram_user_id) VALUES (?)';
    connection.query(authorizeQuery, [userIdToAuthorize], (err) => {
        if (err) {
            console.error('Error authorizing user:', err);
            ctx.reply('Failed to authorize user.');
            return;
        }

        ctx.reply(`User with ID ${userIdToAuthorize} has been authorized.`);
    });
});

// Command to unauthorize a user
bot.command('unauthorize', async (ctx) => {
    const userIdToUnauthorize = ctx.message.text.split(' ')[1];

    if (!superAdmin.includes(ctx.from.id.toString())) {
        ctx.reply('You are not authorized to use this command.');
        return;
    }

    if (!userIdToUnauthorize) {
        ctx.reply('Please provide a user ID to unauthorize.');
        return;
    }

    const unauthorizeQuery = 'DELETE FROM users WHERE telegram_user_id = ?';
    connection.query(unauthorizeQuery, [userIdToUnauthorize], (err) => {
        if (err) {
            console.error('Error unauthorizing user:', err);
            ctx.reply('Failed to unauthorize user.');
            return;
        }

        ctx.reply(`User with ID ${userIdToUnauthorize} has been unauthorized.`);
    });
});

const userStates = {};
let tokenDatas;

async function handleLogin(ctx) {
    try {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;

        const sentMessage = await ctx.reply('Please enter your Maxis Number eg 01234567', {
            reply_markup: {
                force_reply: true,
                selective: true,
            }
        });

        const welcomeMessageId = sentMessage.message_id;

        userStates[userId] = {
            step: 'enterMaxisNumber',
            welcomeMessageId: welcomeMessageId,
        };

    } catch (error) {
        console.error('Error sending Telegram user ID:', error);
    }
}

maxisNumber = '';

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message;

    if (userStates[userId]) {
        const currentState = userStates[userId];

        if (currentState.step === 'enterMaxisNumber') {
            if (message.reply_to_message && message.reply_to_message.message_id === currentState.welcomeMessageId) {
                const maxisNumber = `6${message.text}`;
                console.log(`From: ${userId} Maxis Number entered: ${maxisNumber}`);

                try {
                    const response = await apiService.post('v1.0/openam/login/otp?languageId=1&clientId=HOTLINKPORTAL&brand=hotlink&nonce=hotlinkportal&redirectUrl=https%253A%252F%252Fselfserve.hotlink.com.my%252Fms%252Fauth&responseType=code&scope=openid%2520maxis_profile&realm=null', {
                        "msisdn": maxisNumber,
                    });
                    const data = response.data;

                    if (data.status === 'success') {
                        const sentMessageOtp = await ctx.reply(`OTP Code:`, {
                            reply_markup: {
                                force_reply: true,
                                selective: true,
                            }
                        });
                        const otpMessageId = sentMessageOtp.message_id;

                        userStates[userId] = {
                            step: 'enterOTP',
                            otpMessageId: otpMessageId,
                            authId: data.responseData.authId,
                            sessionId: data.responseData.sessionId,
                            maxisNumber: maxisNumber,
                        };
                    }
                } catch (error) {
                    console.error('Error with API Sending OTP:', error);
                }
            }
        } else if (currentState.step === 'enterOTP') {
            if (message.reply_to_message && message.reply_to_message.message_id === currentState.otpMessageId) {
                const otpCode = message.text;
                console.log(`From: ${userId} OTP Code entered: ${otpCode}`);

                try {
                    const responsetwo = await apiService.put('v1.0/openam/login/otp?languageId=1&clientId=HOTLINKPORTAL&brand=hotlink&nonce=hotlinkportal&redirectUrl=https%253A%252F%252Fselfserve.hotlink.com.my%252Fms%252Fauth&responseType=code&scope=openid%2520maxis_profile&realm=null', {
                        "msisdn": currentState.maxisNumber,
                        "sessionId": currentState.sessionId,
                        "authId": currentState.authId,
                        "otp": otpCode,
                    });

                    const responsetwodata = responsetwo.data;

                    if (responsetwodata.status === 'success') {
                        const authCode = responsetwodata.responseData.authCode;
                        const sessionIds = responsetwodata.responseData.sessionId;

                        try {

                            const responseThree = await apiService.post(
                                'v4.0/users/token?redirectUrl=https://selfserve.hotlink.com.my/ms/auth&brand=HOTLINK&type=OPENAM&clientId=HOTLINKPORTAL&languageId=0',
                                {},
                                {
                                    headers: {
                                        'Authorization': sessionIds,
                                        'Authcode': authCode,
                                        'Channel': 'hra',
                                        'Content-Type': 'application/json',

                                    }
                                }
                            );

                            const tokenData = responseThree.data;
                            userStates[userId].tokenData = tokenData;
                            tokenDatas = userStates[userId].tokenData;

                            const tokenDataStringified = JSON.stringify(tokenDatas.responseData);
                            const updateToken = 'UPDATE users SET token = ? WHERE telegram_user_id = ?';
                            connection.query(updateToken, [tokenDataStringified, userId], (err, results) => {
                                console.log(`token insert!`);
                                if (err) {
                                    console.error('Error updating user token:', err);
                                    return;
                                }

                                const getToken = 'SELECT token FROM users WHERE telegram_user_id = ?';
                                connection.query(getToken, [userId], (err, results) => {
                                    if (err) {
                                        console.error('Error retrieving user token:', err);
                                        tokenDataSaved = null;
                                    } else if (results && results[0] && results[0].token) {
                                        const tokenDataSave = JSON.parse(results[0].token);
                                        tokenDataSaved = tokenDataSave;
                                    } else {
                                        tokenDataSaved = null;
                                    }

                                });
                            });
                            loggedIn(ctx);


                        } catch (error) {
                            console.error('Error with On Auth Code:', error);
                        }

                    }
                } catch (error) {
                    console.error('Error with Login API:', error);
                }

            }
        }
    }
});

async function loggedIn(ctx) {
    const userId = ctx.from.id;

    deleteMessage = await ctx.deleteMessage(ctx.session.tempMessageId);
    await fetchDataFromDB(ctx);
    await checkVoucher(ctx);
    await FetchDataFromApi(ctx);

    const planName = tokenDataSaved.account[0].subscriptions[0].planname;
    const sanitizedPlanName = planName.replace(/_/g, '-');
    sentMessage = ctx.replyWithMarkdown(
        `User Id: *${userId}*\n\n*Account Details:*\n_Number: ${tokenDataSaved.user.mainmsisdn}\nPlan: ${sanitizedPlanName}\nBalance: RM${ctx.session.balance}\nStatus: ${tokenDataSaved.accountstatus}\nExpire: ${ctx.session.expiry}\nVoucher: ${ctx.session.isVoucherAvailable}_`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✨Buy Without Using Voucher✨', callback_data: 'a' },
                    ],
                    [
                        { text: 'Subscribe Data Sabah 30 Day [RM20]', callback_data: 'sabah30' },
                    ],
                    [
                        { text: `Subscribe Data Sabah 7 Day [RM5]`, callback_data: 'sabah07' },
                    ],
                    [
                        { text: `================================` },
                    ],
                    [
                        { text: '✨Buy With Using Claim Voucher✨', callback_data: 'a' },
                    ],
                    [
                        { text: `Subscribe Data Sabah 30 Day [RM5]`, callback_data: 'sabah30voucher' },
                    ],
                    [
                        { text: `Data 10GB (4G/5G) and 10GB (5G) for 7 days [FREE]`, callback_data: '10gb7d' },
                    ],
                    [
                        { text: `Subscribe Unlimited 6Mbps and Uncapped 5G Nights 7 days [FREE]`, callback_data: '5gnight' },
                    ],
                    [
                        { text: `DataRahmah 30Gb + 180 Day Validity [RM15]`, callback_data: 'rahmahvoucher' },
                    ],
                    [
                        { text: 'Logout', callback_data: 'logout' },
                    ],
                ]
            }
        }
    );

    ctx.session.tempMessageId = sentMessage.message_id;
}

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== 2129865779) {
        return;
    }
    const message = ctx.message.text.split(' ').slice(1).join(' ');

    try {
        connection.connect();
        const query = 'SELECT telegram_user_id FROM users';
        const result = await queryAsync(connection, query);

        for (const row of result) {
            const userID = row.telegram_user_id;

            try {
                await bot.telegram.sendMessage(userID, message);
                console.log(`Message sent to user ${userID}`);
            } catch (sendMessageError) {
                if (sendMessageError.code === 403) {
                    console.warn(`User ${userID} has blocked the bot. Skipping.`);
                } else {
                    console.error(`Error sending message to user ${userID}:`, sendMessageError);
                }
            }
        }

        console.log('Broadcast complete!');
    } catch (error) {
        console.error('Error broadcasting message:', error);
    }
});


function queryAsync(connection, query) {
    return new Promise((resolve, reject) => {
        connection.query(query, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

async function FetchDataFromApi(ctx) {
    try {
        const userId = ctx.from.id;

        const response = await appHotlink.get(
            'v5.0/account/balance/credit',
            {
                headers: {
                    'Token': tokenDataSaved.access_token,

                }
            }
        );

        ctx.session.balance = response.data.balance / 100;
        const rawExpiry = response.data.expiry;
        const formattedExpiry = format(new Date(rawExpiry), 'dd MMMM yyyy', { timeZone: 'Asia/Singapore' });
        ctx.session.expiry = formattedExpiry;
    } catch (error) { }
}

async function fetchDataFromDB(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
        const getToken = 'SELECT token FROM users WHERE telegram_user_id = ?';
        connection.query(getToken, [userId], (err, results) => {
            if (err) {
                console.error('Error retrieving user token:', err);
                tokenDataSaved = null;
            } else if (results && results[0] && results[0].token) {

                const tokenDataSave = results[0].token;
                tokenDataSaved = JSON.parse(tokenDataSave);
                // console.log(tokenDataSaved);
            } else {
                tokenDataSaved = null;
            }
        });
    } catch (error) {
        console.error('Error in try-catch block:', error);
        tokenDataSaved = null;
    }
}


bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData === 'login') {
        await handleLogin(ctx);
    }

    if (callbackData === 'loginbypass') {
        await loggedIn(ctx);
    }

    if (callbackData === 'logout') {
        await handleLogout(ctx);
    }

    if (callbackData === 'sabah30voucher') {
        const plan = 'sabah30voucher';
        await handleSubscriptionVoucher(ctx, plan);
    }

    if (callbackData === 'rahmahvoucher') {
        const plan = 'rahmahvoucher';
        await handleSubscriptionVoucher(ctx, plan);
    }

    if (callbackData === '10gb7d') {
        const plan = '10gb7d';
        await handleSubscriptionVoucher(ctx, plan);
    }

    if (callbackData === '5gnight') {
        const plan = '5gnight';
        await handleSubscriptionVoucher(ctx, plan);
    }

    if (callbackData === 'sabah30') {
        const plan = 'sabah30';
        await handleSubscription(ctx, plan);
    }

    if (callbackData === 'sabah07') {
        const plan = 'sabah07';
        await handleSubscription(ctx, plan);
    }

    if (callbackData.startsWith('checkpaymentstatus_')) {
        const billCode = callbackData.split('_')[1];
        await handleCheckPaymentStatus(ctx, billCode);
    }

    if (callbackData === 'back') {
        await handleStart(ctx);
    }

});


async function handleSubscription(ctx, plan) {
    await fetchDataFromDB(ctx);
    const userId = ctx.from.id;
    let boId, message, price;

    if (plan === 'sabah30') {
        boId = '57399278';
        message = 'Sabah 30 Day Subscribed!';
        price = 20;
    } else if (plan === 'sabah07') {
        boId = '57398998';
        message = 'Sabah 7 Day Subscribed!';
        price = 5;
    } else {
        return;
    }

    try {
        const responseBalance = await appHotlink.get(
            'v5.0/account/balance/credit',
            {
                headers: {
                    'Token': tokenDataSaved.access_token,

                }
            }
        );
        const balance = responseBalance.data.balance / 100;
        if (balance < price) {
            await ctx.answerCbQuery(`Insufficient Balance! : RM${balance}`);
            return;
        }

    } catch (error) {
        console.log(error);
    }

    const response = await apiService.post(
        `v4.0/orderdata?msisdn=${tokenDataSaved.user.mainmsisdn}&languageId=0`,
        {
            "ratePlanType": "prepaid",
            "ratePlanId": "57313918",
            "boId": boId,
            "checkEligibility": true,
            "isInternetRoamingCheck": false,
            "type": "domestic",
            "country": "",
            "topic": "",
            "transactionId": 0,
            "bundleMaxisId": []
        },
        {
            headers: {
                'Authorization': tokenDataSaved.access_token,
                'Channel': 'hra',
                'Content-Type': 'application/json',

            }
        }
    );

    const data = response.data;

    if (data.status === 'success') {
        console.log(`From: ${userId} Subscribe ${plan}`);
        await ctx.reply(`${message}`);
    } else {
        await ctx.reply(`Subscribe Fail`);
    }
}

async function handleSubscriptionVoucher(ctx, plan) {
    await checkVoucher(ctx);
    await fetchDataFromDB(ctx);
    const userId = ctx.from.id;
    let boId, message, price;

    if (plan === 'sabah30voucher') {
        boId = '57399278';
        message = 'Data Sabah 30 Day Successful Subscribed!';
        price = 5;
        voucherId = 859;
        campaignId = 760;

    } else if (plan === '10gb7d') {
        boId = '57474098';
        message = 'Successfully Subscribe 10Gb 7days!';
        price = 0;
        voucherId = 859;
        campaignId = 760;

else if (plan === '5gnight') {
        boId = '57473428';
        message = 'Successfully Subscribe Unlimited 6Mbps and Uncapped 5G Nights 7 days';
        price = 0;
        voucherId = 859;
        campaignId = 760;

    } else if (plan === 'rahmahvoucher') {
        boId = '57227118';
        message = 'Rahmah 180Day Plan Subscribed!';
        price = 15;
        voucherId = 859;
        campaignId = 760;
    } else {
        return;
    }

    if (isVoucherAvailable === 0) {
        await ctx.answerCbQuery(`You Have No Voucher Available!`);
        return;
    }

    try {
        const responseBalance = await appHotlink.get(
            'v5.0/account/balance/credit',
            {
                headers: {
                    'Token': tokenDataSaved.access_token,

                }
            }
        );
        const balance = responseBalance.data.balance / 100;
        if (balance < price) {
            await ctx.answerCbQuery(`Insufficient Balance! : RM${balance}`);
            return;
        }

    } catch (error) {
        console.log(error);
    }

    const response = await apiService2.put(
        `v1.0/voucher?accountNumber=${tokenDataSaved.account[0].accountNo}&clearCache=0&languageId=1&msisdn=${tokenDataSaved.user.mainmsisdn}&plan=57313918`,
        {
            "fulfillment": {
                "id": boId,
                "type": "datapass"
            },
            "voucher": {
                "voucherId": voucherId,
                "campaignId": campaignId,
                "userVoucherTransactionId": ctx.session.firstVoucherId,
            }
        },
        {
            headers: {
                'Authorization': tokenDataSaved.access_token,
            }
        }
    );

    const data = response.data;

    if (data.status === 'success') {
        console.log(`From: ${userId} Subscribe ${plan}`);
        await ctx.reply(`${message}`);
    } else {
        await ctx.reply(`Subscribe Fail`);
    }
}

async function checkVoucher(ctx) {
    const userId = ctx.from.id;

    try {
        const responseVoucher = await apiService2.get(
            `v1.0/rewards/voucher/claimed?accountNumber=${tokenDataSaved.account[0].accountNo}&clearCache=0&languageId=1&msisdn=${tokenDataSaved.user.mainmsisdn}&plan=57313918`,
            {
                headers: {
                    'Authorization': tokenDataSaved.access_token,
                }
            }
        );

        // console.log(responseVoucher.data.responseData);

        const eligibleVouchers = responseVoucher.data.responseData.reduce((accumulator, voucherCategory) => {
            const vouchers = voucherCategory.vouchers.filter(voucher => {
                return voucher.rule.minPurchasePrice <= 1500;
            });


            return accumulator.concat(vouchers);
        }, []);

        const userVoucherIds = eligibleVouchers.map(voucher => voucher.userVoucherTransactionId);
        console.log(`Log:${userVoucherIds}`);
        const concatenatedIds = userVoucherIds.join(',');

        const updateVoucher = 'UPDATE users SET vouchertid = ? WHERE telegram_user_id = ?';
        connection.query(updateVoucher, [concatenatedIds, userId], (err, results) => {
            if (err) {
                console.error('Error updating user voucher:', err);
                return;
            }

            ctx.session.firstVoucherId = userVoucherIds[0];
            console.log(`From: ${userId} firstVoucherId: ${ctx.session.firstVoucherId}`);

            if (userVoucherIds.length > 0) {
                ctx.session.isVoucherAvailable = 'Available';
                isVoucherAvailable = 70;
            } else {
                ctx.session.isVoucherAvailable = 'Not Available';
                isVoucherAvailable = 0;
            }
        });
    } catch (error) {
        console.error('Error checking voucher:', error.message);
    }
}


async function handleLogout(ctx) {
    try {
        await ctx.deleteMessage(ctx.session.tempMessageId);
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;

        delete userStates[userId];

        const removeToken = 'UPDATE users SET token = NULL WHERE telegram_user_id = ?';
        connection.query(removeToken, [userId], (err, results) => {
            if (err) {
                console.error('Error removing user token:', err);
            } else {
                tokenDataSaved = null;
            }
        });

        await handleStart(ctx);
    } catch (error) {
        console.error('Error sending Telegram user ID:', error);
    }
}


bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))