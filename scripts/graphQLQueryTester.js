const fetch = require('node-fetch')

const dice = 3
const sides = 6


const mondingusFetcher = async (categoryId, after) => {
    const query = `{
        node(id: "${categoryId}") {
          ... on CollectStep {
            proposals(first: 100 ${after ? `after: "${after}"` : ''}) {
              totalCount
              edges {
                cursor
                node {
                  title
                  body
                  author {
                    username
                  }
                  responses {
                    question {
                      title
                    }
                    ... on ValueResponse {
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }`

    const response = await fetch('https://granddebat.fr/graphql/internal', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables: { dice, sides },
        }),
    }).then().catch(console.log)
    const jsonResponse = await response.json().catch(console.log)

    console.log('data returned:', jsonResponse.data.node.proposals.edges.length)
    console.log(jsonResponse.data.node.proposals.edges[0])
}

mondingusFetcher('Q29sbGVjdFN0ZXA6ZjhlYWUxYmMtMWNlMC0xMWU5LTk0ZDItZmExNjNlZWIxMWUx', 'YXJyYXljb25uZWN0aW9uOjI=')
