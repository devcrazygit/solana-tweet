import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SolanaTwitter } from '../target/types/solana_twitter';
import * as assert from 'assert';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes';

describe('solana-twitter', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>;
  
  it('can send a new tweet', async () => {
    const tweet = anchor.web3.Keypair.generate();
    
    await program.rpc.sendTweet('Test topic', 'test Content', {
      accounts: {
        tweet: tweet.publicKey,
        author: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [tweet]
    })
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    
    assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'Test topic');
    assert.equal(tweetAccount.content, 'test Content');
    assert.ok(tweetAccount.timestamp);
  })
  
  it('can send a new tweet from a different author', async () => {
    const otherUser = anchor.web3.Keypair.generate();
    const tweet = anchor.web3.Keypair.generate();
    
    const signature = await program.provider.connection.requestAirdrop(otherUser.publicKey, 2000000000);
    await program.provider.connection.confirmTransaction(signature);
    
    await program.rpc.sendTweet('New topic', 'Ok', {
      accounts: {
        tweet: tweet.publicKey,
        author: otherUser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [otherUser, tweet]
    });
    
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    assert.equal(tweetAccount.author.toBase58(), otherUser.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'New topic');
    assert.equal(tweetAccount.content, 'Ok');
    assert.ok(tweetAccount.timestamp);
  })
  
  it ('cannot provider a topic with more than 50 characters', async () => {
    try {
      const tweet = anchor.web3.Keypair.generate();
      const topicWith51Chars = 'x'.repeat(51);
      
      await program.rpc.sendTweet(topicWith51Chars, 'Ok', {
        accounts: {
          tweet: tweet.publicKey,
          author: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [tweet]
      })
    } catch (error) {
      assert.equal(error.msg, 'The provided topic should be 50 characters long maximum.');
      return;
    }
    assert.fail('The instruction should have failed with a 51 charater topic');
  })
  it ('filter tweets of mine', async () => {
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8,
          bytes: program.provider.wallet.publicKey.toBase58()
        }
      }
    ]);
    console.log({tweetAccounts})
  })
  
  it ('filter by topic', async () => {
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp: {
          offset: 8 + 32 + 8 + 4,
          bytes: bs58.encode(Buffer.from('New topic'))
        }
      }
    ])
    assert.ok(tweetAccounts.every(tweetAccount => {
      return tweetAccount.account.topic === 'New topic'
    }))
  })
});
