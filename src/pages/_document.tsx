import Document, { Head, Html, Main, NextScript } from 'next/document'
class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <title>404</title>
        </Head>
        <body>
          <pre>null</pre>
        </body>
      </Html>
    )
  }
}

export default MyDocument
