export const typeDefs = `#graphql
  # Scalar types for JSON
  scalar JSON
  scalar DateTime

  # Generic column value
  type ColumnValue {
    columnName: String!
    value: JSON
    dataType: String
  }

  # Row representation
  type Row {
    data: JSON!
  }

  # Table schema information
  type Column {
    column_name: String!
    data_type: String!
    character_maximum_length: Int
    is_nullable: Boolean!
    column_default: String
    ordinal_position: Int!
    is_primary_key: Boolean!
  }

  type Table {
    table_name: String!
    table_schema: String!
    table_type: String
    columns: [Column!]
  }

  # Query result
  type QueryResult {
    rows: [Row!]!
    rowCount: Int!
    columns: [String!]
    executionTime: Float
  }

  # Mutation result
  type MutationResult {
    success: Boolean!
    message: String
    data: JSON
    rowCount: Int
  }

  # Constraint types
  type Constraint {
    constraint_name: String!
    constraint_type: String!
    column_name: String
    referenced_table_name: String
    referenced_column_name: String
    update_rule: String
    delete_rule: String
    check_clause: String
  }

  # Input types for mutations
  input WhereInput {
    field: String!
    value: JSON!
    operator: String # equals, gt, lt, gte, lte, like, in
  }

  input OrderByInput {
    field: String!
    direction: String! # ASC or DESC
  }

  input InsertDataInput {
    data: JSON!
  }

  input UpdateDataInput {
    data: JSON!
    where: JSON!
  }

  input DeleteDataInput {
    where: JSON!
  }

  input CreateTableInput {
    tableName: String!
    columns: [ColumnDefinitionInput!]!
  }

  input ColumnDefinitionInput {
    name: String!
    type: String!
    nullable: Boolean
    defaultValue: String
    primaryKey: Boolean
  }

  input AddColumnInput {
    columnName: String!
    columnType: String!
    nullable: Boolean
    defaultValue: String
  }

  input CreateForeignKeyInput {
    columnName: String!
    referencedTable: String!
    referencedColumn: String!
    onDelete: String
    onUpdate: String
  }

  # Root Query type
  type Query {
    # Get all tables in a project
    tables(projectId: Int!): [Table!]!

    # Get schema for a specific table
    tableSchema(projectId: Int!, tableName: String!): [Column!]!

    # Query data from a table
    queryTable(
      projectId: Int!
      tableName: String!
      columns: [String!]
      where: JSON
      limit: Int
      offset: Int
      orderBy: [OrderByInput!]
    ): QueryResult!

    # Execute raw SQL query
    executeQuery(
      projectId: Int!
      query: String!
      parameters: [JSON!]
    ): QueryResult!

    # Get constraints for a table
    tableConstraints(projectId: Int!, tableName: String!): [Constraint!]!

    # Get foreign keys for a table
    tableForeignKeys(projectId: Int!, tableName: String!): [Constraint!]!
  }

  # Root Mutation type
  type Mutation {
    # Create a new table
    createTable(
      projectId: Int!
      input: CreateTableInput!
    ): MutationResult!

    # Insert data into a table
    insertData(
      projectId: Int!
      tableName: String!
      data: JSON!
    ): MutationResult!

    # Bulk insert data
    bulkInsertData(
      projectId: Int!
      tableName: String!
      dataArray: [JSON!]!
    ): MutationResult!

    # Update data in a table
    updateData(
      projectId: Int!
      tableName: String!
      data: JSON!
      where: JSON!
    ): MutationResult!

    # Delete data from a table
    deleteData(
      projectId: Int!
      tableName: String!
      where: JSON!
    ): MutationResult!

    # Drop a table
    dropTable(
      projectId: Int!
      tableName: String!
    ): MutationResult!

    # Rename a table
    renameTable(
      projectId: Int!
      tableName: String!
      newTableName: String!
    ): MutationResult!

    # Add a column to a table
    addColumn(
      projectId: Int!
      tableName: String!
      input: AddColumnInput!
    ): MutationResult!

    # Drop a column from a table
    dropColumn(
      projectId: Int!
      tableName: String!
      columnName: String!
    ): MutationResult!

    # Create a foreign key constraint
    createForeignKey(
      projectId: Int!
      tableName: String!
      input: CreateForeignKeyInput!
    ): MutationResult!

    # Drop a constraint
    dropConstraint(
      projectId: Int!
      tableName: String!
      constraintName: String!
    ): MutationResult!

    # Create unique constraint
    createUniqueConstraint(
      projectId: Int!
      tableName: String!
      columnName: String!
      constraintName: String
    ): MutationResult!

    # Execute raw SQL mutation
    executeMutation(
      projectId: Int!
      query: String!
      parameters: [JSON!]
    ): MutationResult!
  }
`;

