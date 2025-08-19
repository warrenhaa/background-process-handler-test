module.exports = (sequelize, DataTypes) => {
    const rule_groups = sequelize.define('rule_groups', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            allowNull: false,
            type: DataTypes.STRING,
        },
        icon: {
            allowNull: false,
            type: DataTypes.STRING,
        },
        rules: {
            allowNull: false,
            type: DataTypes.JSONB,
        },
        gateway_id: {
            allowNull: false,
            type: DataTypes.UUID,
        },
        company_id: {
            allowNull: false,
            type: DataTypes.UUID,
        },
        key: {
            allowNull: false,
            type: DataTypes.TEXT,
        },
        created_at: {
            allowNull: false,
            type: DataTypes.DATE,
        },
        updated_at: {
            allowNull: false,
            type: DataTypes.DATE,
        },
    },
        {
            freezeTableName: true,
            tableName: 'rule_groups',
        });
    rule_groups.associate = (models) => {
        rule_groups.belongsTo(models.companies, { foreignKey: 'company_id' });
        rule_groups.belongsTo(models.devices, { foreignKey: 'gateway_id' });
    };
    return rule_groups;
};
