-- Execute the commands here one at a time in a PostgreSQL console or in pgAdmin:

CREATE DATABASE pridemap;

-- IMPORTANT: Here, you need to execute the command "\c pridemap" to connect to the pridemap database

CREATE ROLE pridemap WITH LOGIN SUPERUSER PASSWORD 'Postgres!'; -- This is how the website will connect to the PostgreSQL server

-- You can copy and paste all the commands below in the psql console after connecting to the pridemap database:

-- Table for the categories of locations we will have
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Table for the locations
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    url VARCHAR(255)
);

-- Junction table linking locations to their categories (many-to-many)
CREATE TABLE location_categories (
    id_location INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    id_category INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (id_location, id_category)
);

-- Categories givin in the innitial requirements. TODO: add a way to create these
INSERT INTO categories (name) VALUES
('Advocacy Resources'),
('Community Organisations'),
('Employment Services'),
('Healthcare Resources'),
('Housing and Shelter'),
('Legal Services'),
('Parents and Family Resources'),
('Refugees and Immigrant Resources'),
('Sports and Activity Groups'),
('Student Resources'),
('Queer Nightlife'),
('Queer Businesses'),
('Trans Resources');

-- Locations given in the innitial requirements. TODO: add a way to create these
INSERT INTO locations (name, description, address, latitude, longitude, url) VALUES
('AIDS Committee of Ottawa', 'Our Mission\n To provide support, prevention, education and outreach services from an integrated anti-racism anti-oppression social justice framework that promotes the holistic wellbeing of those living with, affected by, impacted by and at risk of HIV/AIDS in Ottawa.\n\nOur Vision\n A world in which the human rights and dignity of people living with, affected by, impacted by and at risk of HIV/AIDS, are respected and realized; and where societal attitudes, laws and policies facilitate HIV prevention efforts, holistic care, treatment and support.\n\nOur Values\n ACO is a learning organization that operates within an integrated anti-racism anti-oppression social justice framework. We achieve our mission through the following values. \n - Accountability\n - Meaningful involvement of People with HIV/AIDS (MIPA)\n - Health Promotion\n\t - Harm Reduction\n\t - Sex Positivity\n\t - Client-centered holistic approach to health\n\t - Self determination\n - Community Engagement\n\t - Volunteerism\n\t - Collaboratio...', '19 Main St, Ottawa, ON K1S 1A9', 45.414569871406776, -75.68106475060705, 'https://www.aco-cso.ca/'),
('BIPOC Women''s Health Network', 'BIPOC Women''s Health Network - Description to be added', NULL, NULL, NULL, 'https://www.bipocwhn.ca/'),
('Black Femme Legal', 'Black Femme Legal - Description to be added', NULL, NULL, NULL, 'https://www.blackfemmelegal.ca/'),
('Bruce House', 'Who are we: \n Bruce House is committed to ensuring our clients have access to equality, housing stability, supported independence, and opportunities for healthy living.\n \n Our clientele includes women, men and children living with HIV who may be dealing with addiction, mental health issues, homelessness and incarceration. We support a diverse population including members of the LGBTQ community, ACB(African, Caribbean, and Black) communities and Indigenous communities as well as newcomers to Canada.\n \n Housing is a fundamental requirement for the health and well-being of people living with HIV. Bruce House clients benefit from increased housing stability, increased physical and emotional wellness, increased access to resources, decreased in isolation, and the peace of mind that comes from knowing a support network exists for them in times of need.\n \n Since opening its doors in 1988, through the generous support of local individuals and organizations, Bruce House has been delivering a...', '251 Bank St #402, Ottawa, ON K2P 1X2', 45.41630821078194, -75.69684577934396, 'https://www.brucehouse.ca/'),
('Capital Pride', 'Capital Pride - Description to be added', '403 Bank St Studio #2, Ottawa, ON K2P 1Y6', 45.41309092003978, -75.69388619403642, 'https://www.capitalpride.ca/'),
('Capital Pups', 'Capital Pups - Description to be added', NULL, NULL, NULL, 'https://www.capitalpups.ca/'),
('Capital Rainbow Refuge', 'Capital Rainbow Refuge - Description to be added', '499 Preston Street, Ottawa, ON, K1S 4N7', 45.39817586869874, -75.70772795661692, 'https://www.capitalrainbowrefuge.com/'),
('Centertown Community Health Centre', 'Centertown Community Health Centre - Description to be added', '420 Cooper St, Ottawa, ON K2P 2N6', 45.41630821078194, -75.69684577934396, 'https://www.centretownchc.org/'),
('Dignity Network Canada', 'Dignity Network Canada - Description to be added', NULL, NULL, NULL, 'https://dignitynetwork.ca/'),
('Family Services Ottawa', 'Family Services Ottawa - Description to be added', '312 Parkdale Ave, Ottawa, ON K1Y 4X5', 45.40302557056891, -75.7308126288311, 'https://www.familyservicesottawa.org/'),
('Feminist Resource Centre', 'Student Resources', '85 University Private, Ottawa, ON K1N 9A6', 45.42270603677789, -75.6838528130226, 'https://www.feministresourcecentre.ca/'),
('FrancoQueer', 'FrancoQueer - Description to be added', '543 Yonge St 4th Floor, Toronto, ON M4Y 1Y5', 43.664323911630994, -79.38405015044995, 'https://www.francoqueer.ca/'),
('Frontrunners Ottawa Running and Walking Group', 'Frontrunners Ottawa Running and Walking Group - Description to be added', '111 Lisgar St, Ottawa, ON K2P 0C1', 45.42035494626729, -75.6900237011807, 'https://www.frontrunners.ca/ottawa/'),
('GetAKit', 'GetAKit - Description to be added', '801 King Edward Ave, Ottawa, ON K1N 1A2', 45.419723489813045, -75.6775792770682, 'https://www.getakit.ca/'),
('Goodhead', 'Goodhead - Description to be added', NULL, NULL, NULL, 'https://www.goodhead.ca/'),
('Human Rights Legal Support Centre', 'Human Rights Legal Support Centre - Description to be added', '180 Dundas St W #8, Toronto, ON M7A 0A1', 43.655430843541005, -79.38635211348307, 'https://www.hrlsc.on.ca/'),
('IO Advisory', 'IO Advisory - Description to be added', NULL, NULL, NULL, 'https://www.ioadvisory.ca/'),
('KindSpace', 'KindSpace - Description to be added', '400 Cooper St, Ottawa, ON K2P 2N1', 45.41555464716594, -75.69747631530385, 'https://www.kindspace.ca/'),
('Legal Aid Ontario', 'Legal Aid Ontario - Description to be added', '275 Slater St. Suite 1101, Ottawa, ON K1P 5H9', 45.41881475772488, -75.70155599999325, 'https://www.legalaid.on.ca/'),
('Lesbian Outdoor Group', 'Lesbian Outdoor Group - Description to be added', NULL, NULL, NULL, NULL),
('Lookout', 'Lookout - Description to be added', '41 York St 2nd floor, Ottawa, ON K1N 5S7', 45.42809946290381, -75.69368818475029, 'https://www.lookoutbarottawa.com/'),
('MAXOttawa', 'MAXOttawa - Description to be added', NULL, NULL, NULL, 'https://www.maxottawa.ca/'),
('One in Ten', 'Queer Businesses', '256 Bank Street, Ottawa, Ontario, K2P 1X1', 45.4161716, -75.6972827, 'https://www.oneintenottawa.com/'),
('Ottawa Birth and Wellness Centre', 'Ottawa Birth and Wellness Centre - Description to be added', NULL, NULL, NULL, 'https://www.ottawabirthcentre.ca/'),
('Ottawa Community Immigrant Services Organisation', 'Ottawa Community Immigrant Services Organisation - Description to be added', NULL, NULL, NULL, 'https://www.ociso.org/'),
('Ottawa Pride Hockey', 'Ottawa Pride Hockey - Description to be added', NULL, NULL, NULL, 'https://www.ottawapridehockey.com/'),
('Ottawa Public Health Sexual Clinic', 'Ottawa Public Health Sexual Clinic - Description to be added', NULL, NULL, NULL, 'https://www.ottawapublichealth.ca/en/public-health-topics/sexual-health-clinic.aspx'),
('Ottawa TimeOut Hiking Club', 'Ottawa TimeOut Hiking Club - Description to be added', NULL, NULL, NULL, NULL),
('Ottawa Wolves Rugby Club', 'Ottawa Wolves Rugby Club - Description to be added', NULL, NULL, NULL, 'https://www.ottawawolves.ca/'),
('Ottawa''s LGBTQ+ Softball League', 'Ottawa''s LGBTQ+ Softball League - Description to be added', NULL, NULL, NULL, NULL),
('Planned Parenthood Ottawa', 'Planned Parenthood Ottawa - Description to be added', NULL, NULL, NULL, 'https://www.ppottawa.ca/'),
('Pride Capital Volleyball', 'Pride Capital Volleyball - Description to be added', NULL, NULL, NULL, NULL),
('Probe Ottawa', 'Probe Ottawa - Description to be added', NULL, NULL, NULL, NULL),
('Queer Momentum', 'Queer Momentum - Description to be added', NULL, NULL, NULL, 'https://www.queermomentum.ca/'),
('Rainbow Refugee', 'Rainbow Refugee - Description to be added', NULL, NULL, NULL, 'https://www.rainbowrefugee.com/'),
('Rainbow Rockers Curling Club', 'Rainbow Rockers Curling Club - Description to be added', NULL, NULL, NULL, NULL),
('Rideau Speedos', 'Rideau Speedos - Description to be added', NULL, NULL, NULL, 'https://www.rideauspeedos.com/'),
('Stroked Ego', 'Stroked Ego - Description to be added', '131 Bank Street, Ottawa, Ontario, K1P 5N7', 45.4192857, -75.6994607, 'https://www.strokedego.ca/'),
('Swizzles', 'Swizzles - Description to be added', '246 Queen Street, Ottawa, Ontario, K1A 0H5', 45.4199507, -75.7017157, 'https://www.swizzles.ca/'),
('T''s All Welcoming Pub', 'T''s All Welcoming Pub - Description to be added', NULL, NULL, NULL, NULL),
('Ten Oaks Project', 'Ten Oaks Project - Description to be added', NULL, NULL, NULL, 'https://www.tenoaksproject.org/'),
('The Gay Zone', 'The Gay Zone - Description to be added', NULL, NULL, NULL, 'https://www.thegayzone.ca/'),
('Tone Cluster Queer Choir', 'Tone Cluster Queer Choir - Description to be added', NULL, NULL, NULL, 'https://www.tonecluster.ca/'),
('Trans Health Ottawa', 'Trans Health Ottawa - Description to be added', NULL, NULL, NULL, 'https://www.transhealthottawa.ca/'),
('Trans Library of Ottawa', 'Trans Library of Ottawa - Description to be added', 'Somerset Street West, Ottawa, Ontario, K1Y 2X8', 45.4059222, -75.7220587, 'https://www.translibraryottawa.ca/'),
('Trans Outaouais', 'Trans Outaouais - Description to be added', NULL, NULL, NULL, 'https://www.transoutaouais.ca/'),
('University of Carleton Gender and Sexuality Resource Centre', 'University of Carleton Gender and Sexuality Resource Centre - Description to be added', NULL, NULL, NULL, 'https://carleton.ca/gsrc/'),
('University of Ottawa Pride Centre', 'University of Ottawa Pride Centre - Description to be added', NULL, NULL, NULL, 'https://www.uottawa.ca/about-us/overview/equity-human-rights/pride-centre'),
('University of Ottawa''s Community Legal Clinic', 'University of Ottawa''s Community Legal Clinic - Description to be added', NULL, NULL, NULL, 'https://www.communitylegalcentre.ca/'),
('Venus Envy', 'Venus Envy - Description to be added', NULL, NULL, NULL, 'https://www.venusenvy.ca/'),
('Wisdom 2 action', 'Wisdom 2 action - Description to be added', NULL, NULL, NULL, 'https://www.wisdom2action.org/'),
('Youth Services Bureau', 'Youth Services Bureau - Description to be added', '2887 Riverside Drive, Ottawa, Ontario, K1V 8N5', 45.3696699, -75.6896829, 'https://www.ysb.ca/');

-- Default category assignments for each location
INSERT INTO location_categories (id_location, id_category)
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'AIDS Committee of Ottawa'                          AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'BIPOC Women''s Health Network'                   AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Black Femme Legal'                               AND c.name = 'Legal Services'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Bruce House'                                     AND c.name = 'Housing and Shelter'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Capital Pride'                                   AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Capital Pups'                                    AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Capital Rainbow Refuge'                          AND c.name = 'Refugees and Immigrant Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Centertown Community Health Centre'              AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Centertown Community Health Centre'              AND c.name = 'Trans Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Dignity Network Canada'                          AND c.name = 'Advocacy Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Family Services Ottawa'                          AND c.name = 'Parents and Family Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Feminist Resource Centre'                        AND c.name = 'Student Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'FrancoQueer'                                     AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Frontrunners Ottawa Running and Walking Group'   AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'GetAKit'                                         AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Goodhead'                                        AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Human Rights Legal Support Centre'               AND c.name = 'Legal Services'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'IO Advisory'                                     AND c.name = 'Employment Services'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'KindSpace'                                       AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Legal Aid Ontario'                               AND c.name = 'Legal Services'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Lesbian Outdoor Group'                           AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Lookout'                                         AND c.name = 'Queer Nightlife'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'MAXOttawa'                                       AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'One in Ten'                                      AND c.name = 'Queer Businesses'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa Birth and Wellness Centre'                AND c.name = 'Parents and Family Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa Community Immigrant Services Organisation' AND c.name = 'Refugees and Immigrant Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa Pride Hockey'                             AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa Public Health Sexual Clinic'              AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa TimeOut Hiking Club'                      AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa Wolves Rugby Club'                        AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ottawa''s LGBTQ+ Softball League'               AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Planned Parenthood Ottawa'                       AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Pride Capital Volleyball'                        AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Probe Ottawa'                                    AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Queer Momentum'                                  AND c.name = 'Advocacy Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Rainbow Refugee'                                 AND c.name = 'Refugees and Immigrant Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Rainbow Rockers Curling Club'                    AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Rideau Speedos'                                  AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Stroked Ego'                                     AND c.name = 'Queer Businesses'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Swizzles'                                        AND c.name = 'Queer Nightlife'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'T''s All Welcoming Pub'                         AND c.name = 'Queer Nightlife'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Ten Oaks Project'                                AND c.name = 'Parents and Family Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'The Gay Zone'                                    AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Tone Cluster Queer Choir'                        AND c.name = 'Sports and Activity Groups'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Trans Health Ottawa'                             AND c.name = 'Trans Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Trans Health Ottawa'                             AND c.name = 'Healthcare Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Trans Library of Ottawa'                         AND c.name = 'Trans Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Trans Outaouais'                                  AND c.name = 'Trans Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'University of Carleton Gender and Sexuality Resource Centre' AND c.name = 'Student Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'University of Ottawa Pride Centre'               AND c.name = 'Student Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'University of Ottawa''s Community Legal Clinic'  AND c.name = 'Legal Services'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'University of Ottawa''s Community Legal Clinic'  AND c.name = 'Student Resources'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Venus Envy'                                      AND c.name = 'Queer Businesses'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Wisdom 2 action'                                 AND c.name = 'Community Organisations'
UNION ALL
SELECT l.id, c.id FROM locations l, categories c WHERE l.name = 'Youth Services Bureau'                           AND c.name = 'Employment Services';