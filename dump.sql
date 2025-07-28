-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: auto
-- ------------------------------------------------------
-- Server version	8.0.42-0ubuntu0.24.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `car`
--

DROP TABLE IF EXISTS `car`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `car` (
  `id` int NOT NULL AUTO_INCREMENT,
  `brand` varchar(50) NOT NULL,
  `model` varchar(50) NOT NULL,
  `year` smallint unsigned NOT NULL,
  `mileage` int unsigned NOT NULL,
  `vin` varchar(17) DEFAULT NULL,
  `gearbox` varchar(20) NOT NULL,
  `fuel` varchar(20) NOT NULL,
  `powerValue` int unsigned NOT NULL,
  `powerType` varchar(255) NOT NULL,
  `engine` decimal(3,1) NOT NULL,
  `drive` varchar(255) NOT NULL,
  `deferredReload` text,
  `price` int unsigned NOT NULL,
  `description` text,
  `images` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `car`
--

LOCK TABLES `car` WRITE;
/*!40000 ALTER TABLE `car` DISABLE KEYS */;
INSERT INTO `car` VALUES (1,'BMW','530',2018,85921,NULL,'Автомат','Безин',190,'к/с',2.0,'Полный',NULL,200000,'<b>Представляем вашему вниманию BMW 530 2018 года выпуска.</b><br><br>\nЭтот автомобиль сочетает в себе <b>динамику, стиль и комфорт</b>, предлагая идеальный баланс между спортивным характером и премиальным удобством.<br><br>\nАвтоматическая коробка передач обеспечивает <b>плавное и уверенное вождение</b>, а бензиновый двигатель дарит отличную динамику и отзывчивость.<br><br>\nЭлегантный кузов подчеркивает <b>статус и современный стиль владельца</b>, делая BMW 530 выбором для тех, кто ценит качество и престиж.\n','[\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939523968-802332b0.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939523996-6ab73501.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524028-36db3d65.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524069-a6de696f.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524074-c45bf9bc.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524079-273fbcd4.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524084-9508a027.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524089-e9ec3062.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524113-c37dedf6.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524117-a8140bd9.jpg\",\"https://storage.googleapis.com/bossauto-images-prod/images/image_1745939524121-d7b65a0d.jpg\"]');
/*!40000 ALTER TABLE `car` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-28 22:12:17
