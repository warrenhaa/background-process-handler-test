module.exports = (sequelize, DataTypes) => {
    const occupantNotificationTokens = sequelize.define('occupants_notification_tokens', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
        },
        occupant_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        dnd: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
        os: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        token: {
            allowNull: false,
            type: DataTypes.TEXT,
        },
        data: {
            allowNull: true,
            type: DataTypes.JSONB,
        },
        is_enable: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        created_at: {
            allowNull: false,
            type: DataTypes.DATE,
        },
        updated_at: {
            allowNull: false,
            type: DataTypes.DATE,
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    },
        {
            freezeTableName: true,
            tableName: 'occupants_notification_tokens',
        });
    occupantNotificationTokens.associate = (models) => {
        occupantNotificationTokens.belongsTo(models.companies, { foreignKey: 'company_id', targetKey: 'id' });
        occupantNotificationTokens.belongsTo(models.occupants, { foreignKey: 'occupant_id', targetKey: 'id' });
        occupantNotificationTokens.hasMany(models.occupants_equipments_data, { foreignKey: 'notification_token_id' });
    };
    return occupantNotificationTokens;
};
