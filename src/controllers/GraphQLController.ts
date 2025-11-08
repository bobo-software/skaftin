import { ApolloServer, BaseContext } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { Pool } from 'pg';
import { typeDefs } from '../graphql/typeDefs';
import { createResolvers } from '../graphql/resolvers';
import { Application } from 'express';
import bodyParser from 'body-parser';

interface GraphQLContext extends BaseContext {
  req: any;
  userId?: string;
}

class GraphQLController {
  private static apolloServer: ApolloServer<GraphQLContext> | null = null;
  private static pool: Pool;

  /**
   * Initialize GraphQL with database pool
   */
  static async initialize(pool: Pool, app: Application) {
    GraphQLController.pool = pool;

    // Create resolvers with pool
    const resolvers = createResolvers(pool);

    // Create Apollo Server
    GraphQLController.apolloServer = new ApolloServer<GraphQLContext>({
      typeDefs,
      resolvers,
      introspection: true, // Enable introspection for GraphQL Playground/Studio
      includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
    });

    // Start Apollo Server
    await GraphQLController.apolloServer.start();

    console.log('✅ GraphQL server initialized successfully');

    // Apply middleware
    app.use(
      '/api/graphql',
      bodyParser.json({ limit: '10mb' }),
      expressMiddleware(GraphQLController.apolloServer, {
        context: async ({ req, res }) => {
          // You can add authentication context here if needed
          // For now, we'll pass the request object
          return {
            req,
            userId: (req as any).session?.userId, // SuperTokens user ID if available
          };
        },
      }) as any // Type workaround for Express version mismatch
    );

    console.log('✅ GraphQL endpoint registered at /api/graphql');
  }

  /**
   * Get Apollo Server instance
   */
  static getServer() {
    return GraphQLController.apolloServer;
  }

  /**
   * Shutdown Apollo Server gracefully
   */
  static async shutdown() {
    if (GraphQLController.apolloServer) {
      await GraphQLController.apolloServer.stop();
      console.log('GraphQL server stopped');
    }
  }
}

export default GraphQLController;

