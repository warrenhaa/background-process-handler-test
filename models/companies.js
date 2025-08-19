module.exports = (sequelize, DataTypes) => {
  const companies = sequelize.define('companies', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    aws_cognito_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_cognito_region: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_cognito_user_pool: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_cognito_identity_pool: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_cognito_userpool_web_client_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_iam_access_key: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_iam_access_secret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_s3_bucket_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    device_to_user_list: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_to_device_list: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_topics_to_subscribe: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_region: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aws_iot_end_point: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    es_endpoint: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    es_username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    es_password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    index_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rate_limit_policy_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    root_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING,
    },
    updated_by: {
      type: DataTypes.STRING,
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    admin_setup_url: {
      allowNull: true,
      type: DataTypes.TEXT,
    },
    contact_details: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    address_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    activities_configs: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    alert_configs: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    app_urls: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    templates: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    site: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    linked_companies: {
      allowNull: true,
      type: DataTypes.STRING,
    },
    plan_limitations: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    configs: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {});
  companies.associate = function (models) {
    companies.hasOne(models.addresses, { foreignKey: 'company_id', onDelete: 'CASCADE' });
  };
  return companies;
};
