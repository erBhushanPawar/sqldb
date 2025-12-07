import { SmartDBWithTables } from '@bhushanpawar/sqldb';

/**
 * Auto-generated database schema
 * Generated on: 2025-12-07T19:34:57.928Z
 * Total tables: 49
 */
export interface MyDatabaseSchema {
  /**
   * Table: account_subscription
   * Primary key: account_subscription_id
   */
  account_subscription: {
    /** @type uuid | @default uuid() */
    account_subscription_id: string;
    /** @type date | @default NULL */
    subscription_start_date?: Date | null;
    /** @type date | @default NULL */
    subscription_end_date?: Date | null;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type uuid | @default NULL */
    payment_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    subscription_status?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type uuid | @default NULL */
    subscription_id?: string | null;
    /** @type int(11) | @precision 10,0 | @default 30 */
    reminder_before_days?: number | null;
  };

  /**
   * Table: address
   * Primary key: address_id
   */
  address: {
    /** @type uuid | @default uuid() */
    address_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    address_line_1?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    address_line_2?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    city?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    country?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    pincode?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    contact_number?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    type_of_address?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    person_name?: string | null;
    /** @type uuid | @default NULL */
    customer_id?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(45) | @maxLength 45 | @default '0.0' */
    lattitude?: string | null;
    /** @type varchar(45) | @maxLength 45 | @default '0.0' */
    longitude?: string | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_default?: number | null;
    /** @type varchar(45) | @maxLength 45 | @default NULL */
    landmark?: string | null;
  };

  /**
   * Table: app_configurations
   * Primary key: app_configuration_id
   */
  app_configurations: {
    /** @type varchar(36) | @maxLength 36 */
    app_configuration_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    feature?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    attribute?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    value?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: app_info
   * Primary key: app_info_id
   */
  app_info: {
    /** @type int(11) | @precision 10,0 | @extra auto_increment */
    app_info_id: number;
    /** @type varchar(50) | @maxLength 50 */
    app_version: string;
    /** @type varchar(255) | @maxLength 255 */
    domain: string;
  };

  /**
   * Table: article
   * Primary key: article_id
   */
  article: {
    /** @type uuid | @default uuid() */
    article_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    title?: string | null;
    /** @type uuid | @default NULL */
    author_user_id?: string | null;
    /** @type date | @default NULL */
    date_published?: Date | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    category?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    tags?: string | null;
    /** @type int(11) | @precision 10,0 | @default 0 */
    views?: number | null;
    /** @type int(11) | @precision 10,0 | @default 0 */
    likes?: number | null;
    /** @type int(11) | @precision 10,0 | @default 0 */
    comments?: number | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    modified_on?: Date | null;
    /** @type enum('PUBLISHED','REJECTED','DELETED','DRAFT','REVIEW') | @maxLength 9 | @default NULL */
    status?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    html_content?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    article_image_url?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    reviewer_comment?: string | null;
  };

  /**
   * Table: article_likes
   * Primary key: article_like_id
   */
  article_likes: {
    /** @type uuid | @default uuid() */
    article_like_id: string;
    /** @type uuid */
    article_id: string;
    /** @type uuid */
    user_id: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
  };

  /**
   * Table: audit_test
   * Primary key: id
   */
  audit_test: {
    /** @type int(11) | @precision 10,0 */
    id: number;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    name?: string | null;
  };

  /**
   * Table: bank_details
   * Primary key: account_id
   */
  bank_details: {
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type uuid | @default uuid() */
    account_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    account_holder_name?: string | null;
    /** @type varchar(20) | @maxLength 20 */
    account_number: string;
    /** @type varchar(100) | @maxLength 100 */
    bank_name: string;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    branch_name?: string | null;
    /** @type varchar(20) | @maxLength 20 */
    IFSC_code: string;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    upi_id?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_verified?: number | null;
  };

  /**
   * Table: beneficiary
   * Primary key: beneficiary_id
   */
  beneficiary: {
    /** @type char(36) | @maxLength 36 */
    beneficiary_id: string;
    /** @type varchar(255) | @maxLength 255 */
    beneficiary_name: string;
    /** @type varchar(255) | @maxLength 255 */
    beneficiary_account_number: string;
    /** @type varchar(255) | @maxLength 255 */
    beneficiary_ifsc: string;
    /** @type varchar(255) | @maxLength 255 */
    beneficiary_mobile_number: string;
    /** @type varchar(255) | @maxLength 255 */
    beneficiary_email: string;
    /** @type varchar(255) | @maxLength 255 */
    beneficiary_address: string;
    /** @type varchar(255) | @maxLength 255 */
    provider_id: string;
    /** @type text | @maxLength 65535 */
    cashfree_request: string;
    /** @type text | @maxLength 65535 */
    cashfree_response: string;
    /** @type varchar(255) | @maxLength 255 */
    provider_beneficiary_id: string;
    /** @type timestamp | @default current_timestamp() */
    created_on: Date;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on: Date;
    /** @type varchar(255) | @maxLength 255 | @default 'ACTIVE' */
    status?: string | null;
  };

  /**
   * Table: categories
   * Primary key: category_id
   */
  categories: {
    /** @type uuid | @default uuid() */
    category_id: string;
    /** @type text | @maxLength 65535 */
    name: string;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type text | @maxLength 65535 */
    image_url: string;
    /** @type text | @maxLength 65535 */
    dark_color: string;
    /** @type text | @maxLength 65535 */
    light_color: string;
    /** @type text | @maxLength 65535 */
    tags: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type varchar(50) | @maxLength 50 | @default 'ACTIVE' */
    status?: string | null;
  };

  /**
   * Table: chat
   * Primary key: chat_id
   */
  chat: {
    /** @type uuid | @default uuid() */
    chat_id: string;
    /** @type uuid */
    channel_id: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(100) | @maxLength 100 */
    status: string;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    subscriber_list?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    chat_metadata?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    read_by?: string | null;
  };

  /**
   * Table: chat_messages
   * Primary key: chat_message_id
   */
  chat_messages: {
    /** @type uuid | @default uuid() */
    chat_message_id: string;
    /** @type uuid | @default NULL */
    channel_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    event?: string | null;
    /** @type uuid | @default NULL */
    sender_user_id?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    message?: string | null;
    /** @type datetime | @default NULL */
    timestamp?: Date | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    message_body_length?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    host_name?: string | null;
    /** @type datetime | @default NULL */
    server_received_on?: Date | null;
    /** @type text | @maxLength 65535 | @default NULL */
    attachment_list?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    status?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    message_hash?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    read_by?: string | null;
  };

  /**
   * Table: content_moderation_report
   * Primary key: entity_id
   */
  content_moderation_report: {
    /** @type varchar(255) | @maxLength 255 */
    entity_id: string;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    type?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    content?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    reason_of_reporting?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    score_summary?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    admin_check?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    admin_comment?: string | null;
  };

  /**
   * Table: customer
   * Primary key: customer_id
   */
  customer: {
    /** @type uuid | @default uuid() */
    customer_id: string;
    /** @type uuid | @default NULL */
    user_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    name?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    bio?: string | null;
    /** @type varchar(800) | @maxLength 800 | @default NULL */
    profile_picture_url?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    email?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    mobile_number?: string | null;
  };

  /**
   * Table: employees
   * Primary key: id
   */
  employees: {
    /** @type int(11) | @precision 10,0 | @extra auto_increment */
    id: number;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    first_name?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    last_name?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    department?: string | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    salary?: number | null;
    /** @type date | @default NULL */
    hire_date?: Date | null;
  };

  /**
   * Table: featured_items
   * Primary key: featured_id
   */
  featured_items: {
    /** @type uuid | @default uuid() */
    featured_id: string;
    /** @type varchar(255) | @maxLength 255 */
    title: string;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    image_url?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    link_url?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    type?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    status?: string | null;
  };

  /**
   * Table: firebase_tokens
   * Primary key: udid
   */
  firebase_tokens: {
    /** @type varchar(255) | @maxLength 255 */
    udid: string;
    /** @type text | @maxLength 65535 */
    fcm_token: string;
    /** @type uuid | @default NULL */
    customer_id?: string | null;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type timestamp | @default NULL */
    created_on?: Date | null;
    /** @type timestamp | @default NULL */
    updated_on?: Date | null;
  };

  /**
   * Table: like_view
   * Primary key: activity_id
   */
  like_view: {
    /** @type uuid | @default uuid() */
    activity_id: string;
    /** @type char(36) | @maxLength 36 | @default NULL */
    user_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    user_type?: string | null;
    /** @type char(36) | @maxLength 36 | @default NULL */
    feature_id?: string | null;
    /** @type varchar(255) | @maxLength 255 */
    feature_type: string;
    /** @type int(11) | @precision 10,0 | @default 0 */
    view: number;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    likes: number;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    ⁠ like ⁠: number;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: location_info
   * Primary key: location_id
   */
  location_info: {
    /** @type uuid | @default uuid() */
    location_id: string;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    street_address?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    city?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    state?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    country?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    postal_code?: string | null;
    /** @type decimal(10,6) | @precision 10,6 | @default NULL */
    latitude?: number | null;
    /** @type decimal(10,6) | @precision 10,6 | @default NULL */
    longitude?: number | null;
    /** @type int(11) | @precision 10,0 | @default 5 */
    coverage_radius_in_km?: number | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: notification_templates
   * Primary key: template_id
   */
  notification_templates: {
    /** @type uuid | @default uuid() */
    template_id: string;
    /** @type varchar(30) | @maxLength 30 | @default NULL */
    template_type?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    receiver_user_type?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    template_condition?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    title?: string | null;
    /** @type varchar(2000) | @maxLength 2000 | @default NULL */
    description?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    notification_data?: string | null;
    /** @type varchar(300) | @maxLength 300 | @default NULL */
    image?: string | null;
    /** @type varchar(30) | @maxLength 30 | @default NULL */
    status?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type text | @maxLength 65535 | @default NULL */
    notification_object_template?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    scenario?: string | null;
  };

  /**
   * Table: notification_templates_v2
   * Primary key: template_id
   */
  notification_templates_v2: {
    /** @type uuid | @default uuid() */
    template_id: string;
    /** @type varchar(30) | @maxLength 30 | @default NULL */
    template_type?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    receiver_user_type?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    scenario?: string | null;
    /** @type varchar(10) | @maxLength 10 | @default 'en' */
    language_code?: string | null;
    /** @type int(11) | @precision 10,0 | @default 1 */
    version?: number | null;
    /** @type varchar(30) | @maxLength 30 | @default 'active' */
    status?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    template_condition?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    notification_data?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    notification_object_template?: string | null;
    /** @type varchar(300) | @maxLength 300 | @default NULL */
    image?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    sms_template_name?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    sms_body?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    sms_variables?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    email_template_name?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    email_subject?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    email_body?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    email_variables?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    whatsapp_template_name?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    whatsapp_header?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    whatsapp_body?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    whatsapp_footer?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    whatsapp_buttons?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    whatsapp_variables?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    push_title?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    push_body?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    push_variables?: string | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    supports_sms?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    supports_email?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    supports_whatsapp?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    supports_push?: number | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    metadata?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: opening_hours
   * Primary key: opening_hours_id
   */
  opening_hours: {
    /** @type uuid | @default uuid() */
    opening_hours_id: string;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    day_of_week?: number | null;
    /** @type time | @default NULL */
    opening_time?: Date | null;
    /** @type time | @default NULL */
    closing_time?: Date | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
  };

  /**
   * Table: order_history_log
   */
  order_history_log: {
    /** @type uuid | @default uuid() */
    history_id: string;
    /** @type uuid */
    order_id: string;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    status?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    description?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type mediumtext | @maxLength 16777215 | @default NULL */
    created_on_timestamp?: string | null;
  };

  /**
   * Table: orders
   * Primary key: order_id
   */
  orders: {
    /** @type uuid | @default uuid() */
    order_id: string;
    /** @type uuid | @default NULL */
    customer_id?: string | null;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type timestamp | @default current_timestamp() */
    order_date?: Date | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    status?: string | null;
    /** @type decimal(10,2) | @precision 10,2 */
    amount: number;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    service_title?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type uuid | @default NULL */
    shopping_cart_id?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    order_ref_id?: string | null;
    /** @type datetime | @default NULL */
    scheduled_start_date_time?: Date | null;
    /** @type datetime | @default NULL */
    scheduled_end_date_time?: Date | null;
    /** @type datetime | @default NULL */
    requested_end_date_time?: Date | null;
    /** @type datetime | @default NULL */
    requested_start_date_time?: Date | null;
    /** @type text | @maxLength 65535 | @default NULL */
    customer_address?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    provider_address?: string | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    delivery_otp?: number | null;
    /** @type varchar(2000) | @maxLength 2000 | @default NULL */
    instructions_for_provider?: string | null;
    /** @type enum('STORE','AT_DOORSTEP','ANY') | @maxLength 11 | @default NULL */
    delivery_location?: string | null;
    /** @type tinyint(1) | @precision 3,0 | @default NULL */
    is_at_store?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default NULL */
    is_at_door_step?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default NULL */
    is_remote?: number | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    receipt_image_url?: string | null;
    /** @type varchar(45) | @maxLength 45 | @default NULL */
    customer_latitude?: string | null;
    /** @type varchar(45) | @maxLength 45 | @default NULL */
    customer_longitude?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    pricing_model_json?: string | null;
  };

  /**
   * Table: payments
   * Primary key: payment_id
   */
  payments: {
    /** @type uuid | @default uuid() */
    payment_id: string;
    /** @type uuid | @default NULL */
    order_id?: string | null;
    /** @type timestamp | @default current_timestamp() */
    payment_date?: Date | null;
    /** @type decimal(10,2) | @precision 10,2 */
    amount: number;
    /** @type varchar(20) | @maxLength 20 | @default 'PENDING' */
    payment_status?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type text | @maxLength 65535 | @default NULL */
    payment_request?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    payment_response?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    payment_link?: string | null;
  };

  /**
   * Table: payout_history
   * Primary key: payout_history_id
   */
  payout_history: {
    /** @type varchar(36) | @maxLength 36 */
    payout_history_id: string;
    /** @type varchar(255) | @maxLength 255 */
    payout_ref_id: string;
    /** @type timestamp | @default current_timestamp() */
    created_on: Date;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on: Date;
    /** @type varchar(255) | @maxLength 255 */
    status: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    description?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    payout_response?: string | null;
    /** @type char(36) | @maxLength 36 */
    payout_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    transfer_id?: string | null;
  };

  /**
   * Table: payouts
   * Primary key: payout_id
   */
  payouts: {
    /** @type varchar(36) | @maxLength 36 */
    payout_id: string;
    /** @type varchar(255) | @maxLength 255 */
    payout_ref_id: string;
    /** @type varchar(255) | @maxLength 255 */
    order_id: string;
    /** @type varchar(255) | @maxLength 255 */
    order_ref_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    transfer_id?: string | null;
    /** @type decimal(10,2) | @precision 10,2 */
    amount: number;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    payout_batch_id?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    payout_request?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    create_payout_response?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    expected_completion_time?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on: Date;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on: Date;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    provider_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    status?: string | null;
    /** @type varchar(255) | @maxLength 255 */
    provider_beneficiary_id: string;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    amount_without_tax?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    commission?: number | null;
  };

  /**
   * Table: promo_codes
   * Primary key: promo_code_id
   */
  promo_codes: {
    /** @type uuid | @default uuid() */
    promo_code_id: string;
    /** @type varchar(20) | @maxLength 20 */
    code: string;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type enum('PERCENTAGE','AMOUNT') | @maxLength 10 */
    discount_type: string;
    /** @type decimal(10,2) | @precision 10,2 */
    discount_value: number;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    min_order_amount?: number | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    max_uses?: number | null;
    /** @type date | @default NULL */
    start_date?: Date | null;
    /** @type date | @default NULL */
    end_date?: Date | null;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    image_url?: string | null;
    /** @type decimal(10,0) | @precision 10,0 | @default 0 */
    max_discount_amount?: number | null;
    /** @type text | @maxLength 65535 | @default '[]' */
    service_ids?: string | null;
    /** @type varchar(45) | @maxLength 45 | @default 'ACTIVE' */
    status?: string | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    max_use_per_user?: number | null;
  };

  /**
   * Table: provider
   * Primary key: provider_id
   */
  provider: {
    /** @type uuid | @default uuid() */
    provider_id: string;
    /** @type uuid | @default NULL */
    user_id?: string | null;
    /** @type varchar(255) | @maxLength 255 */
    email: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    name?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    bio?: string | null;
    /** @type varchar(2000) | @maxLength 2000 | @default NULL */
    profile_picture_url?: string | null;
    /** @type decimal(10,2) | @precision 10,2 | @default 0.00 */
    balance?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default 1 */
    is_active?: number | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_kyc_completed?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    company_type?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    about?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default 'ACTIVE' */
    status?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    mobile_number?: string | null;
    /** @type varchar(10) | @maxLength 10 | @default NULL */
    country_code?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default '' */
    adhar_front_image?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default '' */
    adhar_back_image?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default '' */
    pan_card_image?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default '' */
    gst_number?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default '' */
    gst_account_name?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default '' */
    pan_card_number?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default '' */
    name_on_pan_card?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default '' */
    provider_beneficiary_id: string;
    /** @type text | @maxLength 65535 | @default NULL */
    about_image?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    bio_image?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    provider_store_images?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    store_address?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    reviewer_comment?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    adhar_card_number?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    app_page_route?: string | null;
    /** @type varchar(300) | @maxLength 300 | @default NULL */
    gst_certificate_image?: string | null;
    /** @type varchar(300) | @maxLength 300 | @default NULL */
    cancelled_cheque_image?: string | null;
    /** @type varchar(13) | @maxLength 13 | @default NULL */
    business_mobile_number?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    mother_name?: string | null;
    /** @type date | @default NULL */
    date_of_birth?: Date | null;
    /** @type smallint(6) | @precision 5,0 | @default 0 */
    is_female_profile?: number | null;
    /** @type smallint(6) | @precision 5,0 | @default 0 */
    is_aadhaar_verified?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    offering_type?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    full_name?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    verification_id?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    reference_id?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    digilocker_response?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    digilocker_url?: string | null;
    /** @type varchar(100) | @maxLength 100 | @default NULL */
    digilocker_status?: string | null;
    /** @type varchar(10) | @maxLength 10 | @default NULL */
    business_mobile_country_code?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    integration_config?: string | null;
  };

  /**
   * Table: provider_special_message
   * Primary key: special_message_id
   */
  provider_special_message: {
    /** @type uuid | @default uuid() */
    special_message_id: string;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    special_message?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    special_message_image?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    more_images?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    reviewer_comment?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    status?: string | null;
    /** @type datetime | @default current_timestamp() | @extra on update current_timestamp() */
    created_on?: Date | null;
    /** @type datetime | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    video_url?: string | null;
  };

  /**
   * Table: recon
   * Primary key: recon_id
   */
  recon: {
    /** @type char(36) | @maxLength 36 */
    recon_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    order_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    customer_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    provider_id?: string | null;
    /** @type datetime | @default NULL */
    order_date?: Date | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    order_status?: string | null;
    /** @type float | @precision 12 | @default NULL */
    order_amount?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    order_ref_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    order_shopping_cart_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    order_service_title?: string | null;
    /** @type float | @precision 12 | @default NULL */
    order_discounted_price?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_tax_percentage?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_tax_amount?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_tax_total?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_delivery_charges?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_price_with_tax?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_platform_fee?: number | null;
    /** @type float | @precision 12 | @default NULL */
    shopping_cart_final?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    payout_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    payout_status?: string | null;
    /** @type float | @precision 12 | @default NULL */
    payout_amount?: number | null;
    /** @type datetime | @default NULL */
    payout_date?: Date | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    payout_ref_id?: string | null;
    /** @type float | @precision 12 | @default NULL */
    amount_without_tax?: number | null;
    /** @type float | @precision 12 | @default NULL */
    commission?: number | null;
    /** @type float | @precision 12 | @default NULL */
    commission_percentage?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    recon_status?: string | null;
    /** @type float | @precision 12 | @default NULL */
    payout_amount_gateway_charges?: number | null;
    /** @type datetime */
    created_on: Date;
    /** @type datetime */
    updated_on: Date;
  };

  /**
   * Table: s3_objects
   */
  s3_objects: {
    /** @type uuid | @default uuid() */
    document_id?: string | null;
    /** @type uuid | @default NULL */
    owner_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    e_tag?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    server_side_encryption?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    location?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    file_key?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    bucket?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: scheduled_activity
   * Primary key: scheduled_activity_id
   */
  scheduled_activity: {
    /** @type char(36) | @maxLength 36 */
    scheduled_activity_id: string;
    /** @type char(36) | @maxLength 36 | @default NULL */
    template_id?: string | null;
    /** @type longtext | @maxLength 4294967295 */
    payload: string;
    /** @type datetime(3) */
    scheduled_at: Date;
    /** @type enum('PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED') | @maxLength 11 | @default 'PENDING' */
    status: string;
    /** @type varchar(128) | @maxLength 128 */
    task_type: string;
    /** @type char(36) | @maxLength 36 */
    scheduled_by: string;
    /** @type int(11) | @precision 10,0 | @default 3 */
    max_retry: number;
    /** @type int(11) | @precision 10,0 | @default 0 */
    retry_count: number;
    /** @type datetime(3) | @default NULL */
    last_retry_at?: Date | null;
    /** @type datetime(3) | @default current_timestamp(3) */
    created_at: Date;
    /** @type datetime(3) | @default current_timestamp(3) | @extra on update current_timestamp(3) */
    updated_at: Date;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: service_views
   * Primary key: service_view_id
   */
  service_views: {
    /** @type char(36) | @maxLength 36 | @default uuid() */
    service_view_id: string;
    /** @type char(36) | @maxLength 36 */
    service_id: string;
    /** @type char(36) | @maxLength 36 */
    user_id: string;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_multi_city: number;
    /** @type timestamp | @default current_timestamp() */
    created_on: Date;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on: Date;
  };

  /**
   * Table: services
   * Primary key: service_id
   */
  services: {
    /** @type uuid | @default uuid() */
    service_id: string;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type varchar(255) | @maxLength 255 */
    title: string;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    category?: string | null;
    /** @type timestamp | @default current_timestamp() */
    creation_date?: Date | null;
    /** @type tinyint(1) | @precision 3,0 | @default 1 */
    is_active?: number | null;
    /** @type uuid | @default NULL */
    sub_category_id?: string | null;
    /** @type uuid | @default NULL */
    category_id?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    base_price?: number | null;
    /** @type uuid | @default NULL */
    tax_type_id?: string | null;
    /** @type uuid | @default NULL */
    tax_id?: string | null;
    /** @type tinyint(4) | @precision 3,0 | @default 0 */
    is_at_door_step?: number | null;
    /** @type tinyint(4) | @precision 3,0 | @default 0 */
    is_cancelable?: number | null;
    /** @type tinyint(4) | @precision 3,0 | @default 0 */
    is_at_store?: number | null;
    /** @type varchar(10) | @maxLength 10 | @default 'ACTIVE' */
    status?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    other_image_urls?: string | null;
    /** @type int(11) | @precision 10,0 | @default 30 */
    task_duration_minutes?: number | null;
    /** @type text | @maxLength 65535 | @default NULL */
    tags?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    image_url?: string | null;
    /** @type int(11) | @precision 10,0 | @default 30 */
    free_cancellation_in_minutes?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    discounted_price?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_available?: number | null;
    /** @type int(11) | @precision 10,0 | @default 0 */
    discount_percentage?: number | null;
    /** @type text | @maxLength 65535 | @default NULL */
    reviewer_comment?: string | null;
    /** @type varchar(1000) | @maxLength 1000 | @default NULL */
    rejection_message?: string | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_multi_city: number;
    /** @type bigint(20) | @precision 19,0 | @default 0 */
    delivery_charges?: number | null;
    /** @type decimal(10,8) | @precision 10,8 | @default 0.00000000 */
    latitude?: number | null;
    /** @type decimal(11,8) | @precision 11,8 | @default 0.00000000 */
    longitude?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    perimeter?: number | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    canonical_city_name?: string | null;
    /** @type tinyint(1) | @precision 3,0 | @default NULL */
    is_remote?: number | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_pre_owned_item?: number | null;
    /** @type varchar(1000) | @maxLength 1000 | @default '{}' */
    currency_based_prices?: string | null;
    /** @type varchar(5) | @maxLength 5 | @default NULL */
    base_currency?: string | null;
  };

  /**
   * Table: services_faq
   * Primary key: faq_id
   */
  services_faq: {
    /** @type uuid | @default uuid() */
    faq_id: string;
    /** @type varchar(255) | @maxLength 255 */
    question: string;
    /** @type uuid */
    service_id: string;
    /** @type text | @maxLength 65535 */
    answer: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: services_review
   * Primary key: review_id
   */
  services_review: {
    /** @type uuid | @default uuid() */
    review_id: string;
    /** @type uuid | @default NULL */
    order_id?: string | null;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type uuid | @default NULL */
    customer_id?: string | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    rating?: number | null;
    /** @type text | @maxLength 65535 | @default NULL */
    comment?: string | null;
    /** @type timestamp | @default current_timestamp() */
    review_date?: Date | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type uuid | @default NULL */
    service_id?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default 'PUBLISHED' */
    status?: string | null;
    /** @type varchar(1000) | @maxLength 1000 | @default NULL */
    reviewed_service_images?: string | null;
    /** @type int(11) | @precision 10,0 | @default NULL */
    service_recommendation?: number | null;
    /** @type tinyint(4) | @precision 3,0 | @default NULL */
    is_service_recommended?: number | null;
  };

  /**
   * Table: services_tax
   * Primary key: tax_id
   */
  services_tax: {
    /** @type uuid | @default uuid() */
    tax_id: string;
    /** @type varchar(255) | @maxLength 255 */
    tax_name: string;
    /** @type int(11) | @precision 10,0 */
    tax_percentage: number;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: shopping_cart
   * Primary key: shopping_cart_id
   */
  shopping_cart: {
    /** @type uuid | @default uuid() */
    shopping_cart_id: string;
    /** @type uuid */
    customer_id: string;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    total_items?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    cart_total?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    total_discount?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default NULL */
    final_price?: number | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    payment_mode?: string | null;
    /** @type uuid | @default NULL */
    promo_code_id?: string | null;
    /** @type uuid | @default NULL */
    payment_id?: string | null;
    /** @type uuid | @default NULL */
    order_id?: string | null;
    /** @type enum('DRAFT','PLACED','IN_PROGRESS','CANCELLED','COMPLETED','DELETED','DELETED_BY_USER') | @maxLength 15 */
    order_status: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type uuid | @default NULL */
    service_id?: string | null;
    /** @type varchar(5) | @maxLength 5 | @default NULL */
    currency?: string | null;
  };

  /**
   * Table: shopping_cart_item
   * Primary key: shopping_cart_item_id
   */
  shopping_cart_item: {
    /** @type uuid | @default uuid() */
    shopping_cart_item_id: string;
    /** @type uuid */
    shopping_cart_id: string;
    /** @type uuid */
    service_id: string;
    /** @type int(11) | @precision 10,0 | @default 1 */
    quantity: number;
    /** @type decimal(10,2) | @precision 10,2 */
    price: number;
    /** @type decimal(10,2) | @precision 10,2 */
    final_price: number;
    /** @type timestamp | @default current_timestamp() */
    added_on?: Date | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: sliders
   * Primary key: slider_id
   */
  sliders: {
    /** @type uuid | @default uuid() */
    slider_id: string;
    /** @type varchar(255) | @maxLength 255 */
    slider_title: string;
    /** @type varchar(1000) | @maxLength 1000 | @default NULL */
    slider_image_url?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    slider_type?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    status?: string | null;
    /** @type varchar(2500) | @maxLength 2500 | @default NULL */
    entity_ids?: string | null;
  };

  /**
   * Table: sub_categories
   * Primary key: sub_category_id
   */
  sub_categories: {
    /** @type uuid | @default uuid() */
    sub_category_id: string;
    /** @type uuid | @default NULL */
    category_id?: string | null;
    /** @type text | @maxLength 65535 */
    name: string;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type text | @maxLength 65535 */
    image_url: string;
    /** @type text | @maxLength 65535 */
    dark_color: string;
    /** @type text | @maxLength 65535 */
    light_color: string;
    /** @type text | @maxLength 65535 */
    tags: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type varchar(45) | @maxLength 45 | @default 'ACTIVE' */
    status?: string | null;
  };

  /**
   * Table: subscription
   * Primary key: subscription_id
   */
  subscription: {
    /** @type uuid | @default uuid() */
    subscription_id: string;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type float | @precision 12 */
    price: number;
    /** @type varchar(20) | @maxLength 20 */
    status: string;
    /** @type int(11) | @precision 10,0 */
    duration_in_days: number;
    /** @type float | @precision 12 */
    discounted_price: number;
    /** @type int(11) | @precision 10,0 */
    max_orders: number;
    /** @type decimal(10,0) | @precision 10,0 */
    commission_percentage: number;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type tinyint(1) | @precision 3,0 | @default 1 */
    is_active?: number | null;
    /** @type timestamp | @default current_timestamp() */
    updated_on?: Date | null;
    /** @type varchar(10) | @maxLength 10 | @default 'INR' */
    currency?: string | null;
    /** @type varchar(300) | @maxLength 300 */
    subscription_name: string;
    /** @type varchar(500) | @maxLength 500 */
    image_url: string;
    /** @type text | @maxLength 65535 | @default '[]' */
    subscription_offerings?: string | null;
    /** @type int(11) | @precision 10,0 | @default 10 */
    rank_id?: number | null;
    /** @type decimal(10,0) | @precision 10,0 | @default 0 */
    commission_amount?: number | null;
    /** @type int(11) | @precision 10,0 | @default 0 */
    no_of_products?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default 0.00 */
    taxes?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default 0.00 */
    platform_fee?: number | null;
    /** @type decimal(10,2) | @precision 10,2 | @default 0.00 */
    final_price?: number | null;
  };

  /**
   * Table: system_settings
   * Primary key: settings_id
   */
  system_settings: {
    /** @type uuid | @default uuid() */
    settings_id: string;
    /** @type uuid | @default NULL */
    user_id?: string | null;
    /** @type varchar(1500) | @maxLength 1500 | @default NULL */
    payment_gateways_settings?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    terms_conditions?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    privacy_policy?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    about_us?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    contact_us?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    general_settings?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    refund_policy?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    customer_terms_conditions?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    customer_privacy_policy?: string | null;
    /** @type varchar(10) | @maxLength 10 | @default NULL */
    country_code?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    system_tax_settings?: string | null;
    /** @type varchar(500) | @maxLength 500 | @default NULL */
    range_units?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
  };

  /**
   * Table: ticket
   * Primary key: ticket_id
   */
  ticket: {
    /** @type uuid | @default uuid() */
    ticket_id: string;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    title?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    category?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    sub_category?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    status?: string | null;
    /** @type uuid | @default NULL */
    customer_id?: string | null;
    /** @type uuid | @default NULL */
    assignee_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    priority?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    type?: string | null;
    /** @type timestamp | @default NULL */
    due_date?: Date | null;
    /** @type text | @maxLength 65535 | @default NULL */
    attachment_url?: string | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type text | @maxLength 65535 | @default NULL */
    provider_profile?: string | null;
    /** @type uuid | @default NULL */
    provider_id?: string | null;
    /** @type text | @maxLength 65535 | @default NULL */
    reviewer_comment?: string | null;
    /** @type uuid | @default NULL */
    reviewer_id?: string | null;
  };

  /**
   * Table: user
   * Primary key: user_id
   */
  user: {
    /** @type uuid | @default uuid() */
    user_id: string;
    /** @type varchar(255) | @maxLength 255 */
    username: string;
    /** @type varchar(255) | @maxLength 255 */
    email: string;
    /** @type varchar(255) | @maxLength 255 */
    password: string;
    /** @type tinyint(1) | @precision 3,0 | @default 1 */
    default_password: number;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    email_verified: number;
    /** @type varchar(10) | @maxLength 10 | @default NULL */
    country_code?: string | null;
    /** @type varchar(10) | @maxLength 10 | @default NULL */
    mobile_iso_code?: string | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    mobile_verified: number;
    /** @type tinyint(1) | @precision 3,0 | @default 1 */
    is_active?: number | null;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type timestamp | @default NULL */
    deleted_at?: Date | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    id_token?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    refresh_token?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    fcm_id?: string | null;
    /** @type varchar(8) | @maxLength 8 | @default NULL */
    mpin?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    mother_name?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    date_of_birth?: string | null;
    /** @type varchar(50) | @maxLength 50 | @default NULL */
    mpin_token?: string | null;
    /** @type datetime | @default NULL */
    requested_delete_date_time?: Date | null;
    /** @type tinyint(1) | @precision 3,0 | @default 0 */
    is_delete_requested?: number | null;
  };

  /**
   * Table: user_notification
   * Primary key: user_notification_id
   */
  user_notification: {
    /** @type uuid | @default uuid() */
    user_notification_id: string;
    /** @type timestamp | @default current_timestamp() */
    created_on?: Date | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on?: Date | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    notification?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    data?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    token?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    topic?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    notification_condition?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    android?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    apns?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    webpush?: string | null;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    fcm_options?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    template_id?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    delivery_status?: string | null;
    /** @type varchar(255) | @maxLength 255 | @default NULL */
    read_status?: string | null;
    /** @type varchar(20) | @maxLength 20 | @default NULL */
    user_type?: string | null;
  };

  /**
   * Table: videos
   * Primary key: video_id
   */
  videos: {
    /** @type uuid | @default uuid() */
    video_id: string;
    /** @type varchar(255) | @maxLength 255 */
    video_url: string;
    /** @type varchar(255) | @maxLength 255 */
    title: string;
    /** @type varchar(255) | @maxLength 255 */
    thumbnail_url: string;
    /** @type varchar(255) | @maxLength 255 */
    video_type: string;
    /** @type varchar(255) | @maxLength 255 | @default 'DRAFT' */
    status: string;
    /** @type timestamp | @default current_timestamp() */
    created_on: Date;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_on: Date;
    /** @type text | @maxLength 65535 | @default NULL */
    description?: string | null;
  };

  /**
   * Table: vw_prewarmed_services
   * Primary key: service_id
   */
  vw_prewarmed_services: {
    /** @type uuid */
    service_id: string;
    /** @type longtext | @maxLength 4294967295 | @default NULL */
    payload?: string | null;
    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    last_updated?: Date | null;
  };

}

// Type for your database client
export type DB = SmartDBWithTables<MyDatabaseSchema>;

/**
 * Usage example:
 *
 * import { createSmartDB } from '@bhushanpawar/sqldb';
 * import { DB } from "./db-schema";
 *
 * const db = await createSmartDB(config) as DB;
 *
 * // Now you have full type safety:
 * const account_subscription = await db.account_subscription.findMany();
 * const address = await db.address.findMany();
 * const app_configurations = await db.app_configurations.findMany();
 */