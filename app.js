
const express = require('express')
const request = require('request')
const sleep = require('sleep')
const app = express()

const clientId = process.env.MONZO_CLIENT_ID
if (!clientId) {
    console.log('Client ID not found...')
    throw new Error('Client ID not found')
}

const clientSecret = process.env.MONZO_CLIENT_SECRET
if (!clientId) {
    console.log('Client secret not found...')
    throw new Error('Client Secret not found')
}

const oauthDetails = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: 'http://localhost:3000/oauth/callback'
}

let accessToken = null

app.get('/', (req, res) => {
const { client_id, redirect_uri } = oauthDetails
    const monzoAuthUrl = 'https://auth.monzo.com'
    res.type('html')
    res.send(`
    <h1>Hello</h1>

    <form action="${monzoAuthUrl}">
        <input type="hidden" name="client_id" value="${client_id}" />
        <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
        <input type="hidden" name="response_type" value="code" />
        <button>Sign in</button>
    </form>
    `)
})

app.get('/oauth/callback', (req, res) => {
    const { client_id, client_secret, redirect_uri } = oauthDetails
    const { code } = req.query
    const monzoAuthUrl = `https://api.monzo.com/oauth2/token`
    
    // Initiate request to retrieve access token
    request.post({
      url: monzoAuthUrl,
      form: {
        grant_type: 'authorization_code',
        client_id,
        client_secret,
        redirect_uri,
        code
      } 
    }, (err, response, body) => {
        sleep.sleep(15)
        accessToken = JSON.parse(body) // Populate accessToken variable with token response
        res.redirect('/accounts') // Send user to their accounts
    })
  })

app.get('/accounts', (req, res) => {
    const { token_type, access_token } = accessToken
    const accountsUrl = 'https://api.monzo.com/accounts'

    request.get(accountsUrl, {
        headers: {
        Authorization: `${token_type} ${access_token}` 
        }
    }, (req, response, body) => {

        const { accounts } = JSON.parse(body)
        res.type('html')

        if (accounts.code === 'forbidden.insufficient_permissions') {
            res.write(`Monzo: ${accounts.message}`)
            res.end()
        } else {
            res.write('<h1>Accounts</h1><ul>')
        
            for(let account of accounts) {
            const {id, type, description } = account
            res.write(`
                <li>
                ${description}(<i>${type}</i>) - <a href="/transactions/${id}">View transaction history</a>
                </li>
            `)
            }
            res.end('</ul>')
        }
    })
})

app.get('/transactions/:acc_id', (req, res) => {
    const { acc_id } = req.params
    const { token_type, access_token } = accessToken
    const transactionsUrl = `https://api.monzo.com/transactions?expand[]=merchant&account_id=${acc_id}`
    
    request.get(transactionsUrl, {
      headers: {
        Authorization: `${token_type} ${access_token}` 
      }
    }, (req, response, body) => {
      const { transactions } = JSON.parse(body)
  
      res.type('html')
      res.write(`
        <h1>Transactions</h1>
        <table>
          <thead>
            <th>Description</th>
            <th>Amount</th>
            <th>Category</th>
          </thead>
          <tbody>
      `)
      
      for(let transaction of transactions) {
        const {
          description,
          amount,
          category
        } = transaction
        
        res.write(`
          <tr>
            <td>${description}</td>
            <td>${(amount/100).toFixed(2)}</td>
            <td>${category}</td>
          </tr>
        `)
      }
      
      res.write('</tbody></table>')
      res.end('<br /><a href="/accounts">&lt; Back to accounts</a>')
    })
  })

// run app
const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`'listening on port ${port}...'`)
})